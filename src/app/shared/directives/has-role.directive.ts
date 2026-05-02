import {
  Directive,
  inject,
  Input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import type { UserRole } from '../../../graphql/generated/graphql';
import { AuthStore } from '../../core/auth/auth.store';

@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthStore);

  @Input() set appHasRole(roles: UserRole[] | UserRole | undefined) {
    this.vcr.clear();
    if (!roles) {
      this.vcr.createEmbeddedView(this.tpl);
      return;
    }
    const need = Array.isArray(roles) ? roles : [roles];
    const role = this.auth.user()?.role;
    if (role && need.includes(role)) {
      this.vcr.createEmbeddedView(this.tpl);
    }
  }
}
