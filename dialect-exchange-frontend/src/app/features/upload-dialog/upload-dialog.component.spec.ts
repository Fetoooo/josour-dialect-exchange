import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UploadDialogComponent } from './upload-dialog.component';
import { ExchangeService } from '../../core/services/exchange.service';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';

describe('UploadDialogComponent (Upload State Handling)', () => {
  let component: UploadDialogComponent;
  let fixture: ComponentFixture<UploadDialogComponent>;
  let exchangeServiceSpy: any;
  let dialogRefSpy: any;
  let snackBarSpy: any;

  beforeEach(async () => {
    exchangeServiceSpy = {
      uploadExchange: vi.fn().mockReturnValue(of({ success: true }))
    };
    dialogRefSpy = {
      close: vi.fn()
    };
    snackBarSpy = {
      open: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UploadDialogComponent],
      providers: [
        provideAnimationsAsync(),
        { provide: ExchangeService, useValue: exchangeServiceSpy },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with default states and not loading', () => {
    expect(component).toBeTruthy();
    expect(component.isLoading()).toBe(false);
    expect(component.selectedFile).toBeNull();
  });

  it('should capture selected file', () => {
    const mockFile = new File(['audio content'], 'audio.mp3', { type: 'audio/mp3' });
    const event = { target: { files: [mockFile] } };

    component.onFileSelected(event);

    expect(component.selectedFile).toBe(mockFile);
  });

  it('should not initiate upload if no file is selected', () => {
    component.selectedFile = null;
    component.onUpload();

    expect(exchangeServiceSpy.uploadExchange).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('should manage loading state and close dialog on upload success', () => {
    const mockFile = new File(['video content'], 'video.mp4', { type: 'video/mp4' });
    component.selectedFile = mockFile;
    component.uploadData = {
      title: 'Egyptian greeting audio',
      dialectId: '3ce6f6a4-af09-471a-bc08-0fd73db19936',
      mediaType: 'audio',
      description: 'Useful everyday greeting'
    };

    component.onUpload();

    expect(exchangeServiceSpy.uploadExchange).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
    expect(snackBarSpy.open).toHaveBeenCalledWith('تم النشر بنجاح!', 'تم', { duration: 3000 });
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('should reset loading state and show snackbar error on upload failure', () => {
    exchangeServiceSpy.uploadExchange.mockReturnValue(throwError(() => new Error('Upload failed')));
    const mockFile = new File(['content'], 'file.mp3', { type: 'audio/mp3' });
    component.selectedFile = mockFile;

    component.onUpload();

    expect(component.isLoading()).toBe(false);
    expect(snackBarSpy.open).toHaveBeenCalledWith('حدث خطأ أثناء الرفع', 'إغلاق');
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });
});
