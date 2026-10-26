import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import * as signalR from '@microsoft/signalr';
import { Observable } from 'rxjs';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';

export type CallState = 'idle' | 'calling' | 'incoming' | 'active';
export type CallType = 'video' | 'audio';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http         = inject(HttpClient);
  private notifService = inject(NotificationService);
  private authService  = inject(AuthService);
  private snackBar     = inject(MatSnackBar);
  private apiUrl = environment.apiUrl + 'Messages';
  private hubUrl = environment.hubUrl;
  private hubConnection?: signalR.HubConnection;

  private notifiedMessageIds = new Set<string>();

  // ── Chat state ────────────────────────────────────────
  messages    = signal<any[]>([]);
  onlineUsers = signal<string[]>([]);
  isConnected = signal(false);

  // ── Call state ────────────────────────────────────────
  callState        = signal<CallState>('idle');
  callType         = signal<CallType>('video');
  remoteUser       = signal<{ id: string; name: string } | null>(null);
  incomingCallFrom = signal<{ callerId: string; callerName: string; callType: CallType } | null>(null);

  // WebRTC
  private peerConnection?: RTCPeerConnection;
  localStream  = signal<MediaStream | null>(null);
  remoteStream = signal<MediaStream | null>(null);

  private iceServersConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  fetchIceServers(): void {
    this.http.get<{ iceServers: any[]; hasTurn: boolean }>(`${environment.apiUrl}calls/ice-servers`).subscribe({
      next: (res) => {
        if (res?.iceServers && Array.isArray(res.iceServers) && res.iceServers.length > 0) {
          this.iceServersConfig = { iceServers: res.iceServers };
        }
      },
      error: () => {
        // Fallback to STUN servers remains active
      }
    });
  }

  // ── SignalR Connection ────────────────────────────────
  startConnection(token: string) {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) return;

    this.fetchIceServers();

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets |
                   signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => {
        this.isConnected.set(true);
        this.hubConnection!.invoke('GetOnlineUsers');
      })
      .catch(err => console.error('SignalR connection error:', err));

    // ── Chat events ───────────────────────────────────
    this.hubConnection.on('ReceiveMessage', (msg: any) => {
      this.messages.update(list => {
        if (list.some(m => m.id === msg.id)) return list;
        return [...list, msg];
      });

      const myId = this.authService.currentUser()?.id;
      if (msg.senderId !== myId && !this.notifiedMessageIds.has(msg.id)) {
        this.notifiedMessageIds.add(msg.id);
        this.notifService.notifyMessage(
          msg.senderName ?? 'مستخدم',
          msg.content ?? (msg.messageType === 'image' ? '📷 صورة' : '🎙 رسالة صوتية'),
          msg.senderId
        );
      }
    });

    this.hubConnection.on('MessageEdited', (data: any) => {
      this.messages.update(list => list.map(m =>
        m.id === data.messageId
          ? { ...m, content: data.newContent, isEdited: true, editedAt: data.editedAt }
          : m
      ));
    });

    this.hubConnection.on('MessageDeleted', (data: any) => {
      this.messages.update(list => list.map(m =>
        m.id === data.messageId
          ? { ...m, content: 'تم حذف هذه الرسالة', isDeleted: true, fileUrl: null }
          : m
      ));
    });

    this.hubConnection.on('OnlineUsers', (ids: string[]) => this.onlineUsers.set(ids));
    this.hubConnection.on('UserOnline',  (id: string)    => {
      this.onlineUsers.update(l => l.includes(id) ? l : [...l, id]);
    });
    this.hubConnection.on('UserOffline', (id: string) => {
      this.onlineUsers.update(l => l.filter(x => x !== id));
    });

    // ── ★ Real-time notifications from server ─────────
    this.hubConnection.on('ReceiveNotification', (data: any) => {
      this.notifService.push({
        type: data.type,
        title: data.title,
        body: data.body,
        icon: data.icon,
        fromUser: data.fromUser,
        targetId: data.targetId
      });
    });

    // ── Call signaling ────────────────────────────────
    this.hubConnection.on('IncomingCall', (data: any) => {
      this.incomingCallFrom.set({
        callerId: data.callerId, callerName: data.callerName,
        callType: data.callType ?? 'video'
      });
      this.callState.set('incoming');
    });

    this.hubConnection.on('CallAccepted', async (calleeId: string) => {
      this.callState.set('active');
      await this.createAndSendOffer(calleeId);
    });

    this.hubConnection.on('CallRejected', () => {
      this.callState.set('idle');
      this.remoteUser.set(null);
      this.cleanupCall();
      this.snackBar.open('تم رفض المكالمة من الطرف الآخر', 'إغلاق', { duration: 4000 });
    });

    this.hubConnection.on('CallEnded', () => {
      this.callState.set('idle');
      this.remoteUser.set(null);
      this.cleanupCall();
      this.snackBar.open('تم إنهاء المكالمة', 'إغلاق', { duration: 3000 });
    });

    this.hubConnection.on('CallFailed', (reason: string) => {
      console.warn('Call failed:', reason);
      this.callState.set('idle');
      this.remoteUser.set(null);
      this.cleanupCall();
      this.snackBar.open(reason || 'المستخدم غير متاح حالياً للمكالمة', 'إغلاق', { duration: 4000 });
    });

    this.hubConnection.on('ReceiveOffer', async (sdp: string) => {
      await this.handleOffer(sdp);
    });

    this.hubConnection.on('ReceiveAnswer', async (sdp: string) => {
      await this.peerConnection?.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp })
      );
    });

    this.hubConnection.on('ReceiveIceCandidate', async (candidateJson: string) => {
      try {
        const candidate = JSON.parse(candidateJson);
        await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    });

    this.hubConnection.onclose(    () => this.isConnected.set(false));
    this.hubConnection.onreconnected(() => this.isConnected.set(true));
  }

  stopConnection() {
    this.cleanupCall();
    this.hubConnection?.stop();
    this.isConnected.set(false);
  }

  // ── Chat methods ──────────────────────────────────────
  async sendMessage(receiverId: string, content: string) {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      const token = this.authService.currentUser()?.token ?? localStorage.getItem('token') ?? '';
      if (token) {
        if (!this.hubConnection) {
          this.startConnection(token);
        } else if (this.hubConnection.state === signalR.HubConnectionState.Disconnected) {
          try {
            await this.hubConnection.start();
            this.isConnected.set(true);
          } catch (e) {
            console.warn('Reconnection error:', e);
          }
        }
      }
    }

    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('SendMessage', receiverId, content)
        .catch(err => {
          console.error('Send error:', err);
          this.snackBar.open('تعذر إرسال الرسالة، يرجى المحاولة ثانية.', 'إغلاق', { duration: 3000 });
        });
    } else {
      this.snackBar.open('جارٍ إعادة الاتصال بالخادم... يرجى المحاولة بعد قليل.', 'حسناً', { duration: 3000 });
    }
  }

  async sendFileMessage(receiverId: string, fileUrl: string, fileName: string, fileSize: number, messageType: string) {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      const token = this.authService.currentUser()?.token ?? localStorage.getItem('token') ?? '';
      if (token && this.hubConnection?.state === signalR.HubConnectionState.Disconnected) {
        try {
          await this.hubConnection.start();
          this.isConnected.set(true);
        } catch {}
      }
    }

    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('SendFileMessage', receiverId, fileUrl, fileName, fileSize, messageType)
        .catch(err => console.error('SendFile error:', err));
    }
  }

  editMessage(messageId: string, newContent: string) {
    if (!this.hubConnection || !this.isConnected()) return;
    this.hubConnection.invoke('EditMessage', messageId, newContent)
      .catch(err => console.error('Edit error:', err));
  }

  deleteMessage(messageId: string) {
    if (!this.hubConnection || !this.isConnected()) return;
    this.hubConnection.invoke('DeleteMessage', messageId)
      .catch(err => console.error('Delete error:', err));
  }

  uploadFile(file: File, type: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/upload?type=${type}`, formData);
  }

  clearMessages() { this.messages.set([]); }

  getHistory(otherUserId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/history/${otherUserId}`);
  }

  getConversations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/conversations`);
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  // ── Call methods ──────────────────────────────────────
  async initiateCall(targetUserId: string, targetName: string, type: CallType = 'video') {
    this.remoteUser.set({ id: targetUserId, name: targetName });
    this.callState.set('calling');
    this.callType.set(type);

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };

      const constraints: MediaStreamConstraints = {
        audio: audioConstraints,
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream.set(stream);
    } catch (err: any) {
      console.error('Media error:', err);
      this.callState.set('idle');
      this.remoteUser.set(null);
      this.cleanupCall();
      this.snackBar.open('تعذر تشغيل الميكروفون أو الكاميرا. يرجى التأكد من صلاحيات المتصفح.', 'إغلاق', { duration: 4000 });
      return;
    }

    try {
      await this.hubConnection?.invoke('CallUser', targetUserId, targetName, type);
    } catch (err: any) {
      console.error('CallUser invoke error:', err);
      this.callState.set('idle');
      this.remoteUser.set(null);
      this.cleanupCall();
      this.snackBar.open('فشل بدء المكالمة. يرجى التحقق من اتصالك بالإنترنت.', 'إغلاق', { duration: 4000 });
    }
  }

  async acceptCall() {
    const caller = this.incomingCallFrom();
    if (!caller) return;

    this.remoteUser.set({ id: caller.callerId, name: caller.callerName });
    this.callState.set('active');
    this.callType.set(caller.callType);
    this.incomingCallFrom.set(null);

    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      };

      const constraints: MediaStreamConstraints = {
        audio: audioConstraints,
        video: caller.callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream.set(stream);
    } catch (err) {
      console.error('Media error:', err);
      this.callState.set('idle');
      this.remoteUser.set(null);
      this.cleanupCall();
      this.hubConnection?.invoke('RejectCall', caller.callerId);
      this.snackBar.open('تعذر فتح الميكروفون/الكاميرا للرد على المكالمة.', 'إغلاق', { duration: 4000 });
      return;
    }

    this.createPeerConnection(caller.callerId);
    await this.hubConnection?.invoke('AcceptCall', caller.callerId);
  }

  rejectCall() {
    const caller = this.incomingCallFrom();
    if (caller) this.hubConnection?.invoke('RejectCall', caller.callerId);
    this.incomingCallFrom.set(null);
    this.callState.set('idle');
  }

  endCall() {
    const remote = this.remoteUser();
    if (remote) this.hubConnection?.invoke('EndCall', remote.id);
    this.callState.set('idle');
    this.remoteUser.set(null);
    this.cleanupCall();
  }

  toggleMute(): boolean {
    const stream = this.localStream();
    if (!stream) return false;
    const track = stream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled;
  }

  toggleCamera(): boolean {
    const stream = this.localStream();
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled;
  }

  // ── WebRTC internals ──────────────────────────────────
  private createPeerConnection(remoteUserId: string) {
    this.peerConnection = new RTCPeerConnection(this.iceServersConfig);
    this.localStream()?.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream()!);
    });
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream.set(event.streams[0]);
      } else {
        let stream = this.remoteStream();
        if (!stream) {
          stream = new MediaStream();
          this.remoteStream.set(stream);
        }
        stream.addTrack(event.track);
      }
    };
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.hubConnection?.invoke('SendIceCandidate', remoteUserId, JSON.stringify(event.candidate));
      }
    };
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        this.cleanupCall();
        this.callState.set('idle');
        this.remoteUser.set(null);
      }
    };
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      if (iceState === 'failed' || iceState === 'closed') {
        this.cleanupCall();
        this.callState.set('idle');
        this.remoteUser.set(null);
      }
    };
  }

  private async createAndSendOffer(calleeId: string) {
    this.createPeerConnection(calleeId);
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);
    await this.hubConnection?.invoke('SendOffer', calleeId, offer.sdp);
  }

  private async handleOffer(sdp: string) {
    const caller = this.remoteUser();
    if (!caller) return;
    if (!this.peerConnection) this.createPeerConnection(caller.id);
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);
    await this.hubConnection?.invoke('SendAnswer', caller.id, answer.sdp);
  }

  private cleanupCall() {
    this.localStream()?.getTracks().forEach(t => t.stop());
    this.localStream.set(null);
    this.remoteStream.set(null);
    this.peerConnection?.close();
    this.peerConnection = undefined;
  }
}