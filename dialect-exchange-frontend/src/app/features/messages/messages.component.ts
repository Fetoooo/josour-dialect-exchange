import {
  Component, inject, OnInit, OnDestroy, signal, computed,
  ElementRef, ViewChild, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { VideoCallComponent } from '../video-call/video-call.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatIconModule, MatButtonModule, MatProgressSpinnerModule,
    MatTooltipModule, VideoCallComponent
  ],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss'
})
export class MessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageList') messageListRef!: ElementRef;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('videoInput') videoInputRef!: ElementRef<HTMLInputElement>;

  public authService = inject(AuthService);
  public chatService = inject(ChatService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  conversations = signal<any[]>([]);
  allUsers = signal<any[]>([]);
  activeChat = signal<any | null>(null);
  newMessage = signal('');
  isLoadingHistory = signal(false);
  showUserSearch = signal(false);
  userSearchQuery = signal('');
  convSearchQuery = signal('');
  convFilter = signal<'all' | 'unread' | 'online'>('all');
  showPartnerInfo = signal(false);

  // Edit state
  editingMessageId = signal<string | null>(null);
  editContent = signal('');

  // Context menu
  contextMenuMsg = signal<any | null>(null);
  contextMenuPos = signal({ x: 0, y: 0 });

  // Voice recording
  isRecording = signal(false);
  recordingSeconds = signal(0);
  private mediaRecorder?: MediaRecorder;
  private recordingChunks: Blob[] = [];
  private recordingTimer?: ReturnType<typeof setInterval>;

  // File upload state
  isUploading = signal(false);

  // Image preview
  previewImageUrl = signal<string | null>(null);

  myId = computed(() => this.authService.currentUser()?.id ?? '');

  filteredUsers = computed(() => {
    const q = this.userSearchQuery().toLowerCase().trim();
    if (!q) return this.allUsers();
    return this.allUsers().filter(u => u.displayName?.toLowerCase().includes(q));
  });

  filteredConversations = computed(() => {
    let list = this.conversations();
    const filter = this.convFilter();
    const q = this.convSearchQuery().toLowerCase().trim();

    if (filter === 'unread') {
      list = list.filter(c => (c.unreadCount ?? 0) > 0);
    } else if (filter === 'online') {
      list = list.filter(c => this.chatService.onlineUsers().includes(c.userId));
    }

    if (q) {
      list = list.filter(c =>
        c.displayName?.toLowerCase().includes(q) ||
        c.lastMessage?.toLowerCase().includes(q)
      );
    }

    return list;
  });

  showCallOverlay = computed(() =>
    this.chatService.callState() === 'active'
  );

  totalUnread = computed(() =>
    this.conversations().reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
  );

  private shouldScrollBottom = false;

  ngOnInit() {
    const user = this.authService.currentUser();
    if (!user) { this.router.navigate(['/login']); return; }
    this.chatService.startConnection(user.token);
    this.chatService.getConversations().subscribe({ next: d => this.conversations.set(d) });
    this.chatService.getAllUsers().subscribe({ next: d => this.allUsers.set(d) });

    // Close context menu on outside click
    document.addEventListener('click', this.closeContextMenu.bind(this));
  }

  ngOnDestroy() {
    this.chatService.stopConnection();
    this.chatService.clearMessages();
    this.stopRecording();
    document.removeEventListener('click', this.closeContextMenu.bind(this));
  }

  ngAfterViewChecked() {
    if (this.shouldScrollBottom) {
      this.scrollToBottom();
      this.shouldScrollBottom = false;
    }
  }

  openChat(user: any) {
    this.activeChat.set(user);
    this.showUserSearch.set(false);
    this.chatService.clearMessages();
    this.isLoadingHistory.set(true);
    this.editingMessageId.set(null);
    this.showPartnerInfo.set(false);

    const partnerId = user.userId ?? user.id;

    this.chatService.getHistory(partnerId).subscribe({
      next: (history) => {
        this.chatService.messages.set(history);
        this.isLoadingHistory.set(false);
        this.shouldScrollBottom = true;
        this.conversations.update(list =>
          list.map(c => (c.userId === partnerId) ? { ...c, unreadCount: 0 } : c)
        );
      },
      error: () => {
        this.isLoadingHistory.set(false);
      }
    });
  }

  closeChat() {
    this.activeChat.set(null);
    this.chatService.clearMessages();
  }

  togglePartnerInfo() {
    this.showPartnerInfo.update(v => !v);
  }

  // ── Text message ─────────────────────────────────────
  sendMessage() {
    const content = this.newMessage().trim();
    const target = this.activeChat();
    if (!content || !target) return;
    const receiverId = target.userId ?? target.id;
    this.chatService.sendMessage(receiverId, content);
    this.newMessage.set('');
    this.shouldScrollBottom = true;
    this.updateConvPreview(receiverId, target.displayName, content);
  }

  insertEmoji(emoji: string) {
    this.newMessage.update(m => m + emoji);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ── Image upload ─────────────────────────────────────
  triggerImagePick() { this.imageInputRef.nativeElement.click(); }

  async onImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploading.set(true);
    this.chatService.uploadFile(file, 'image').subscribe({
      next: (res) => {
        const target = this.activeChat();
        if (!target) return;
        this.chatService.sendFileMessage(
          target.userId ?? target.id, res.url, res.fileName, res.fileSize, 'image'
        );
        this.isUploading.set(false);
        this.shouldScrollBottom = true;
        this.updateConvPreview(target.userId ?? target.id, target.displayName, '📷 صورة');
      },
      error: (err) => {
        this.isUploading.set(false);
        this.snackBar.open(err?.error?.message || 'فشل إرسال الصورة. يرجى المحاولة مرة أخرى.', 'إغلاق', { duration: 4000 });
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  // ── Video upload ─────────────────────────────────────
  triggerVideoPick() { this.videoInputRef.nativeElement.click(); }

  async onVideoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploading.set(true);
    this.chatService.uploadFile(file, 'video').subscribe({
      next: (res) => {
        const target = this.activeChat();
        if (!target) return;
        this.chatService.sendFileMessage(
          target.userId ?? target.id, res.url, res.fileName, res.fileSize, 'video'
        );
        this.isUploading.set(false);
        this.shouldScrollBottom = true;
        this.updateConvPreview(target.userId ?? target.id, target.displayName, '📹 مقطع فيديو');
      },
      error: (err) => {
        this.isUploading.set(false);
        this.snackBar.open(err?.error?.message || 'فشل إرسال الفيديو. يرجى المحاولة مرة أخرى.', 'إغلاق', { duration: 4000 });
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  // ── File upload ──────────────────────────────────────
  triggerFilePick() { this.fileInputRef.nativeElement.click(); }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Smart routing: if user picked image or video from file picker
    if (file.type.startsWith('image/')) {
      return this.onImageSelected(event);
    }
    if (file.type.startsWith('video/')) {
      return this.onVideoSelected(event);
    }

    this.isUploading.set(true);
    const type = file.type.startsWith('audio/') ? 'voice' : 'file';
    this.chatService.uploadFile(file, type).subscribe({
      next: (res) => {
        const target = this.activeChat();
        if (!target) return;
        const preview = res.type === 'voice' ? '🎙 رسالة صوتية' : `📎 ${res.fileName}`;
        this.chatService.sendFileMessage(
          target.userId ?? target.id, res.url, res.fileName, res.fileSize, res.type
        );
        this.isUploading.set(false);
        this.shouldScrollBottom = true;
        this.updateConvPreview(target.userId ?? target.id, target.displayName, preview);
      },
      error: (err) => {
        this.isUploading.set(false);
        this.snackBar.open(err?.error?.message || 'فشل إرسال الملف. يرجى المحاولة مرة أخرى.', 'إغلاق', { duration: 4000 });
      }
    });
    (event.target as HTMLInputElement).value = '';
  }

  // ── Voice recording ───────────────────────────────────
  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.recordingChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.recordingChunks.push(e.data);
      };
      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingSeconds.set(0);
      this.recordingTimer = setInterval(() => this.recordingSeconds.update(s => s + 1), 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
      this.snackBar.open('تعذر فتح الميكروفون. تأكد من منح الإذن للمتصفح.', 'إغلاق', { duration: 4000 });
    }
  }

  stopRecording() {
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    if (!this.mediaRecorder || !this.isRecording()) return;

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordingChunks, { type: 'audio/webm' });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      this.uploadVoice(file);
      this.mediaRecorder?.stream.getTracks().forEach(t => t.stop());
    };

    this.mediaRecorder.stop();
    this.isRecording.set(false);
    this.recordingSeconds.set(0);
  }

  cancelRecording() {
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
      this.mediaRecorder.stop();
    }
    this.isRecording.set(false);
    this.recordingSeconds.set(0);
    this.recordingChunks = [];
  }

  private uploadVoice(file: File) {
    this.isUploading.set(true);
    this.chatService.uploadFile(file, 'voice').subscribe({
      next: (res) => {
        const target = this.activeChat();
        if (!target) return;
        this.chatService.sendFileMessage(
          target.userId ?? target.id, res.url, res.fileName, res.fileSize, 'voice'
        );
        this.isUploading.set(false);
        this.shouldScrollBottom = true;
        this.updateConvPreview(target.userId ?? target.id, target.displayName, '🎙 رسالة صوتية');
      },
      error: () => this.isUploading.set(false)
    });
  }

  get formattedRecording(): string {
    const s = this.recordingSeconds();
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  // ── Edit / Delete ─────────────────────────────────────
  openContextMenu(event: MouseEvent, msg: any) {
    if (!this.isMine(msg) || msg.isDeleted) return;
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuMsg.set(msg);
    this.contextMenuPos.set({ x: event.clientX, y: event.clientY });
  }

  closeContextMenu() {
    this.contextMenuMsg.set(null);
  }

  canEdit(msg: any): boolean {
    if (msg.messageType !== 'text' || msg.isDeleted) return false;
    return (Date.now() - new Date(msg.sentAt).getTime()) < 5 * 60 * 1000;
  }

  canDelete(msg: any): boolean {
    if (msg.isDeleted) return false;
    return (Date.now() - new Date(msg.sentAt).getTime()) < 5 * 60 * 1000;
  }

  startEdit(msg: any) {
    this.editingMessageId.set(msg.id);
    this.editContent.set(msg.content);
    this.contextMenuMsg.set(null);
  }

  submitEdit() {
    const id = this.editingMessageId();
    const content = this.editContent().trim();
    if (!id || !content) return;
    this.chatService.editMessage(id, content);
    this.editingMessageId.set(null);
    this.editContent.set('');
  }

  cancelEdit() {
    this.editingMessageId.set(null);
    this.editContent.set('');
  }

  deleteMessage(msg: any) {
    this.chatService.deleteMessage(msg.id);
    this.contextMenuMsg.set(null);
  }

  // ── Calls ─────────────────────────────────────────────
  async startVideoCall() {
    const target = this.activeChat();
    if (!target) return;
    await this.chatService.initiateCall(target.userId ?? target.id, target.displayName, 'video');
  }

  async startAudioCall() {
    const target = this.activeChat();
    if (!target) return;
    await this.chatService.initiateCall(target.userId ?? target.id, target.displayName, 'audio');
  }

  acceptCall() { this.chatService.acceptCall(); }
  rejectCall() { this.chatService.rejectCall(); }

  // ── Helpers ───────────────────────────────────────────
  isMine(msg: any): boolean { return msg.senderId === this.myId(); }

  formatFileSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  openImagePreview(url: string) { this.previewImageUrl.set(url); }
  closeImagePreview() { this.previewImageUrl.set(null); }

  private updateConvPreview(userId: string, displayName: string, preview: string) {
    this.conversations.update(list => {
      const exists = list.find(c => c.userId === userId);
      if (exists) return list.map(c => c.userId === userId
        ? { ...c, lastMessage: preview, lastMessageAt: new Date() } : c);
      return [{ userId, displayName, lastMessage: preview, lastMessageAt: new Date(), unreadCount: 0 }, ...list];
    });
  }

  private scrollToBottom() {
    try {
      const el = this.messageListRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}