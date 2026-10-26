import {
  Component, Inject, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface MediaPlayerData {
  id?: string;
  title: string;
  mediaUrl: string;
  type: string; // 'video' | 'audio' | 'voice_note'
  dialect: string;
  flag: string;
  user: string;
}

@Component({
  selector: 'app-media-player-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  templateUrl: './media-player-dialog.component.html',
  styleUrl: './media-player-dialog.component.scss'
})
export class MediaPlayerDialogComponent {
  @ViewChild('mediaEl') mediaEl!: ElementRef<HTMLVideoElement | HTMLAudioElement>;

  constructor(
    public dialogRef: MatDialogRef<MediaPlayerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MediaPlayerData
  ) {}

  close() {
    this.dialogRef.close();
  }
}