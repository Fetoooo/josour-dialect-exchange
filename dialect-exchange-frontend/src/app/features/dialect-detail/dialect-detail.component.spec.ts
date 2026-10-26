import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialectDetailComponent } from './dialect-detail.component';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

describe('DialectDetailComponent (Dialect Navigation)', () => {
  let component: DialectDetailComponent;
  let fixture: ComponentFixture<DialectDetailComponent>;
  let paramMapSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    paramMapSubject = new BehaviorSubject(convertToParamMap({ id: '1' }));

    await TestBed.configureTestingModule({
      imports: [DialectDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
            snapshot: { paramMap: convertToParamMap({ id: '1' }) }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DialectDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create DialectDetailComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should load Egyptian dialect details when ID is 1', () => {
    const dialect = component.dialect;
    expect(dialect.id).toBe('1');
    expect(dialect.nameAr).toBe('المصرية');
    expect(dialect.country).toBe('مصر');
  });

  it('should dynamically update dialect details when route param changes to Levantine (2)', () => {
    paramMapSubject.next(convertToParamMap({ id: '2' }));
    fixture.detectChanges();

    const dialect = component.dialect;
    expect(dialect.id).toBe('2');
    expect(dialect.nameAr).toBe('الشامية');
    expect(dialect.flag).toBe('🇸🇾');
  });

  it('should navigate between different dialect IDs such as Gulf (3) and Iraqi (4)', () => {
    paramMapSubject.next(convertToParamMap({ id: '3' }));
    fixture.detectChanges();
    expect(component.dialect.nameAr).toBe('الخليجية');

    paramMapSubject.next(convertToParamMap({ id: '4' }));
    fixture.detectChanges();
    expect(component.dialect.nameAr).toBe('العراقية');
  });

  it('should fallback to default dialect if unknown dialect ID is passed', () => {
    paramMapSubject.next(convertToParamMap({ id: 'unknown-999' }));
    fixture.detectChanges();

    const dialect = component.dialect;
    expect(dialect.id).toBe('1');
    expect(dialect.nameAr).toBe('المصرية');
  });
});
