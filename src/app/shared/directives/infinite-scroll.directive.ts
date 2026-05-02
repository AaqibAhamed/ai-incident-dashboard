import {
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  /** Intersection ratio threshold (0–1) */
  readonly appInfiniteScrollThreshold = input(0.1);

  readonly loadMore = output<void>();

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              this.zone.run(() => this.loadMore.emit());
            }
          }
        },
        { root: null, threshold: this.appInfiniteScrollThreshold() },
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
