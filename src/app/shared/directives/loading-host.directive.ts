import { Directive, HostBinding, input } from '@angular/core';

/**
 * Composable loading chrome: use with `hostDirectives` on cards/tables.
 */
@Directive({
  selector: '[appLoadingHost]',
  standalone: true,
})
export class LoadingHostDirective {
  readonly appLoadingHost = input(false);

  @HostBinding('style.opacity')
  get opacity(): string {
    return this.appLoadingHost() ? '0.55' : '1';
  }

  @HostBinding('style.pointer-events')
  get pointer(): string {
    return this.appLoadingHost() ? 'none' : 'auto';
  }
}
