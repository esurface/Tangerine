import { TangyFormService } from './tangy-forms/tangy-form.service';
import { MenuService } from './shared/_services/menu.service';
import { Component, OnInit, ChangeDetectorRef, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AuthenticationService } from './core/auth/_services/authentication.service';
import { WindowRef } from './core/window-ref.service';
import { MediaMatcher } from '@angular/cdk/layout';
import { MatSidenav } from '@angular/material/sidenav';
import { UserService } from './core/auth/_services/user.service';
import { AppConfigService } from './shared/_services/app-config.service';
import { _TRANSLATE } from './shared/_services/translation-marker';
import { NgxPermissionsService } from 'ngx-permissions';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

  loggedIn = false;
  validSession: boolean;
  user_id: string = localStorage.getItem('user_id');
  private childValue: string;
  isAdminUser = false;
  history: string[] = [];
  titleToUse: string;
  mobileQuery: MediaQueryList;
  window: any;
  menuService: MenuService;
  sessionTimeoutCheckTimerID;
  isConfirmDialogActive = false;

  @ViewChild('snav', {static: true}) snav: MatSidenav;

  private _mobileQueryListener: () => void;

  constructor(
    private windowRef: WindowRef,
    private router: Router,
    private userService: UserService,
    menuService: MenuService,
    private authenticationService: AuthenticationService,
    private tangyFormService: TangyFormService,
    translate: TranslateService,
    changeDetectorRef: ChangeDetectorRef,
    media: MediaMatcher,
    private appConfigService: AppConfigService,
    private permissionService: NgxPermissionsService
  ) {
    translate.setDefaultLang('translation');
    translate.use('translation');
    this.mobileQuery = media.matchMedia('(max-width: 600px)');
    this.mobileQuery.addEventListener('change', (event => this.snav.opened = !event.matches));
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
    this.window = this.windowRef.nativeWindow;
    // Tell tangyFormService which groupId to use.
    tangyFormService.initialize(window.location.pathname.split('/')[2]);
    this.menuService = menuService;
  }

  async logout() {
    clearInterval(this.sessionTimeoutCheckTimerID);
    await this.authenticationService.logout();
    this.loggedIn = false;
    this.isAdminUser = false;
    this.permissionService.flushPermissions();
    this.user_id = null;
    this.router.navigate(['/login']);
  }

  async ngOnInit() {
    this.snav.opened = true
    this.authenticationService.currentUserLoggedIn$.subscribe(async isLoggedIn => {
      if (isLoggedIn) {
        this.loggedIn = isLoggedIn;
        this.isAdminUser = await this.userService.isCurrentUserAdmin();
        if(Object.entries(this.permissionService.getPermissions()).length===0){
          const permissions = JSON.parse(localStorage.getItem('permissions'));
          this.permissionService.loadPermissions(permissions.sitewidePermissions);
        }
        this.user_id = localStorage.getItem('user_id');
        this.sessionTimeoutCheck();
        this.sessionTimeoutCheckTimerID =
        setInterval(await this.sessionTimeoutCheck.bind(this), 10 * 60 * 1000); // check every 10 minutes
      } else {
        this.loggedIn = false;
        this.isAdminUser = false;
        this.permissionService.flushPermissions();
        this.user_id = null;
        this.router.navigate(['/login']);
      }
    });
    this.window.translation = await this.appConfigService.getTranslations();
  }

  ngOnDestroy(): void {
    this.mobileQuery.removeListener(this._mobileQueryListener);
  }

  async sessionTimeoutCheck() {
    const token = localStorage.getItem('token');
    const claims = JSON.parse(atob(token.split('.')[1]));
    const expiryTimeInMs = claims['exp'] * 1000;
    const minutesBeforeExpiry = expiryTimeInMs - (15 * 60 * 1000); // warn 15 minutes before expiry of token
    if (Date.now() >= minutesBeforeExpiry && !this.isConfirmDialogActive) {
      this.isConfirmDialogActive = true;
      const extendSession = confirm(_TRANSLATE('You are about to be logged out from Tangerine. Should we extend your session?'));
      if (extendSession) {
        await this.authenticationService.extendUserSession();
        this.isConfirmDialogActive = false;
      } else {
        await this.logout();
      }
    }
  }

}
