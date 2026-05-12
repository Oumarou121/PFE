import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { UserPageComponent } from './user-page.component';
import { EditorStateService } from '../../services/editor-state.service';

describe('UserPageComponent', () => {
  let fixture: ComponentFixture<UserPageComponent>;
  let state: EditorStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => ({ id: 'u1', email: 'u@test.local', name: 'User', role: 'user', organizationId: 'org_1' }),
            logout: () => undefined,
            currentUser$: of(null)
          }
        }
      ]
    }).compileComponents();

    state = TestBed.inject(EditorStateService);
    state.replaceState({
      organizations: [{ id: 'org_1', nom: 'Org 1', graphicCharters: [] }],
      families: [],
      templates: [],
      admins: [],
      tableViews: [],
      settings: {},
      _loaded: { organizations: true, families: true, templates: true }
    });
    spyOn(state, 'ensureResources').and.resolveTo(state.getState());

    fixture = TestBed.createComponent(UserPageComponent);
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
  });

  it('should create the Angular user page without legacy iframe', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance).toBeTruthy();
    expect(compiled.querySelector('iframe')).toBeNull();
    expect(compiled.textContent).toContain('Generation de documents');
    expect(compiled.textContent).toContain('Org 1');
  });
});
