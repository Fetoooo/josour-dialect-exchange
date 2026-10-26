import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExchangeService } from './exchange.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { signal } from '@angular/core';

describe('ExchangeService', () => {
  let service: ExchangeService;
  let httpTesting: HttpTestingController;
  let mockAuthService: any;
  const apiUrl = environment.apiUrl + 'Exchanges';

  beforeEach(() => {
    localStorage.clear();
    mockAuthService = {
      currentUser: signal({ id: 'user-abc', email: 'test@example.com' })
    };

    TestBed.configureTestingModule({
      providers: [
        ExchangeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    });

    service = TestBed.inject(ExchangeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch exchanges from API and synchronize liked IDs', () => {
    const mockExchanges = [
      { id: 'ex-1', title: 'Egyptian slang', likes: 5, isLiked: true },
      { id: 'ex-2', title: 'Levantine greeting', likes: 2, isLiked: false }
    ];

    service.getExchanges().subscribe(data => {
      expect(data.length).toBe(2);
      expect(service.isLiked('ex-1')).toBe(true);
      expect(service.isLiked('ex-2')).toBe(false);
    });

    const req = httpTesting.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockExchanges);
  });

  it('should perform optimistic like toggle and confirm with backend', () => {
    const post = { id: 'ex-100', likes: 4, isLiked: false };

    const result = service.toggleLike(post);
    expect(result).toBe(true);
    expect(post.likes).toBe(5);
    expect(post.isLiked).toBe(true);
    expect(service.isLiked('ex-100')).toBe(true);

    const req = httpTesting.expectOne(`${apiUrl}/ex-100/like`);
    expect(req.request.method).toBe('POST');
    req.flush({ likes: 5, isLiked: true });

    expect(post.likes).toBe(5);
    expect(post.isLiked).toBe(true);
  });

  it('should rollback optimistic like when backend responds with an error', () => {
    const post = { id: 'ex-200', likes: 10, isLiked: false };

    service.toggleLike(post);
    expect(post.likes).toBe(11);
    expect(post.isLiked).toBe(true);

    const req = httpTesting.expectOne(`${apiUrl}/ex-200/like`);
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    // Rollback should restore original values
    expect(post.likes).toBe(10);
    expect(post.isLiked).toBe(false);
    expect(service.isLiked('ex-200')).toBe(false);
  });

  it('should post upload FormData correctly', () => {
    const formData = new FormData();
    formData.append('title', 'New test dialect phrase');

    service.uploadExchange(formData).subscribe(res => {
      expect(res.success).toBe(true);
    });

    const req = httpTesting.expectOne(`${apiUrl}/upload`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, id: 'ex-300' });
  });

  it('should add comment and fetch existing comments', () => {
    const mockComments = [
      { id: 'c-1', content: 'Great pronunciation!' }
    ];

    service.getComments('ex-1').subscribe(comments => {
      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('Great pronunciation!');
    });

    const getReq = httpTesting.expectOne(`${apiUrl}/ex-1/comments`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush(mockComments);

    service.addComment('ex-1', 'Very useful').subscribe(res => {
      expect(res.id).toBe('c-2');
    });

    const postReq = httpTesting.expectOne(`${apiUrl}/ex-1/comments`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ content: 'Very useful' });
    postReq.flush({ id: 'c-2', content: 'Very useful' });
  });
});