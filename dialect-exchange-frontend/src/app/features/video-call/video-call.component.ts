import {
  Component, inject, signal, OnDestroy,
  ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../core/services/chat.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './video-call.component.html',
  styleUrl: './video-call.component.scss'
})
export class VideoCallComponent implements AfterViewInit, OnDestroy {
  @ViewChild('localVideo') localVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteAudio') remoteAudioRef?: ElementRef<HTMLAudioElement>;

  public chatService = inject(ChatService);
  isMuted = signal(false);
  isCameraOff = signal(false);
  callDuration = signal(0);
  private timerInterval?: ReturnType<typeof setInterval>;
  private streamCheckInterval?: ReturnType<typeof setInterval>;

  ngAfterViewInit() {
    // Bind local stream
    const localStream = this.chatService.localStream();
    if (localStream && this.localVideoRef?.nativeElement) {
      this.localVideoRef.nativeElement.srcObject = localStream;
    }

    // Poll for remote stream
    this.streamCheckInterval = setInterval(() => {
      const remoteStream = this.chatService.remoteStream();
      if (!remoteStream) return;

      if (this.chatService.callType() === 'video' && this.remoteVideoRef?.nativeElement) {
        this.remoteVideoRef.nativeElement.srcObject = remoteStream;
        this.remoteVideoRef.nativeElement.play().catch(e => console.warn('Remote video play error:', e));
      } else if (this.chatService.callType() === 'audio' && this.remoteAudioRef?.nativeElement) {
        this.remoteAudioRef.nativeElement.srcObject = remoteStream;
        this.remoteAudioRef.nativeElement.play().catch(e => console.warn('Remote audio play error:', e));
      }
      clearInterval(this.streamCheckInterval);
    }, 300);

    // Start duration timer
    this.timerInterval = setInterval(() => this.callDuration.update(s => s + 1), 1000);
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.streamCheckInterval) clearInterval(this.streamCheckInterval);
  }

  toggleMute() { this.isMuted.set(this.chatService.toggleMute()); }
  toggleCamera() { this.isCameraOff.set(this.chatService.toggleCamera()); }
  endCall() { this.chatService.endCall(); }

  get formattedDuration(): string {
    const s = this.callDuration();
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }
}