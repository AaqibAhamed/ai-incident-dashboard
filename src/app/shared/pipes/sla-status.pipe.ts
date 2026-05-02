import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'slaStatus',
  standalone: true,
  pure: true,
})
export class SlaStatusPipe implements PipeTransform {
  transform(slaBreached: boolean, slaDueAt: unknown): string {
    if (slaBreached) return 'Breached';
    const d =
      slaDueAt instanceof Date
        ? slaDueAt
        : typeof slaDueAt === 'string'
          ? new Date(slaDueAt)
          : null;
    if (!d || Number.isNaN(d.getTime())) return 'OK';
    if (d.getTime() < Date.now()) return 'Due';
    const h = Math.ceil((d.getTime() - Date.now()) / 3600000);
    return `${h}h left`;
  }
}
