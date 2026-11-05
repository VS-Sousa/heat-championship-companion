import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [NgClass, TranslatePipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  host: {
    class: 'relative block w-full',
  },
  template: `
    <button
      #trigger
      type="button"
      class="heat-input flex w-full items-center justify-between gap-2 text-left"
      [class.opacity-40]="isDisabled"
      [class.cursor-not-allowed]="isDisabled"
      [attr.id]="inputId || null"
      [attr.aria-expanded]="open()"
      [attr.aria-haspopup]="'listbox'"
      [disabled]="isDisabled"
      (click)="toggle()"
    >
      <span class="min-w-0 flex-1 truncate" [class.text-heat-muted]="!selectedLabel()">
        {{ selectedLabel() || placeholder || ('common.select' | t) }}
      </span>
      <span class="shrink-0 text-heat-muted" aria-hidden="true">▾</span>
    </button>

    @if (open()) {
      <div
        class="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-sm border border-heat-border bg-heat-steel shadow-lg"
        role="listbox"
      >
        <div class="border-b border-heat-border p-2">
          <input
            #searchInput
            type="search"
            class="heat-input"
            [value]="query()"
            [placeholder]="'common.search' | t"
            autocomplete="off"
            (input)="onQuery($any($event.target).value)"
            (keydown)="onKeydown($event)"
            (click)="$event.stopPropagation()"
          />
        </div>
        <ul class="max-h-56 overflow-y-auto py-1">
          @for (option of visibleOptions(); track option.value + ':' + option.label; let i = $index) {
            <li>
              <button
                type="button"
                class="flex w-full px-3 py-2 text-left text-sm transition enabled:hover:bg-heat-yellow/10"
                [ngClass]="{
                  'bg-heat-yellow/15': i === highlightIndex(),
                  'text-heat-yellow': option.value === innerValue,
                  'text-heat-muted cursor-not-allowed': option.disabled
                }"
                [disabled]="option.disabled"
                (click)="choose(option)"
                (mouseenter)="highlightIndex.set(i)"
              >
                <span class="truncate">{{ option.label }}</span>
              </button>
            </li>
          } @empty {
            <li class="px-3 py-3 text-sm text-heat-muted">
              {{ 'common.noResults' | t }}
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class SearchableSelectComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;

  @Input() options: SearchableSelectOption[] = [];
  @Input() placeholder = '';
  @Input() inputId = '';
  @Input() set value(next: string | null) {
    this.innerValue = next ?? '';
  }
  get value(): string {
    return this.innerValue;
  }
  @Input() set disabled(value: boolean) {
    this.isDisabled = value;
  }

  @Output() valueChange = new EventEmitter<string>();

  innerValue = '';
  isDisabled = false;

  readonly open = signal(false);
  readonly query = signal('');
  readonly highlightIndex = signal(0);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  selectedLabel(): string {
    return this.options.find((o) => o.value === this.innerValue)?.label ?? '';
  }

  filteredOptions(): SearchableSelectOption[] {
    const q = this.normalize(this.query());
    if (!q) return this.options;
    return this.options.filter((o) => this.normalize(o.label).includes(q));
  }

  visibleOptions(): SearchableSelectOption[] {
    const filtered = this.filteredOptions();
    if (!this.placeholder || this.options.some((o) => o.value === '')) {
      return filtered;
    }
    const empty: SearchableSelectOption = {
      value: '',
      label: this.placeholder,
    };
    const q = this.normalize(this.query());
    if (q && !this.normalize(empty.label).includes(q)) {
      return filtered;
    }
    return [empty, ...filtered];
  }

  writeValue(value: string | null): void {
    this.innerValue = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  toggle(): void {
    if (this.isDisabled) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.openDropdown();
  }

  openDropdown(): void {
    this.query.set('');
    this.highlightIndex.set(this.indexOfValue(this.visibleOptions()));
    this.open.set(true);
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.query.set('');
    this.onTouched();
  }

  onQuery(value: string): void {
    this.query.set(value);
    this.highlightIndex.set(0);
  }

  choose(option: SearchableSelectOption): void {
    if (option.disabled) return;
    this.innerValue = option.value;
    this.onChange(option.value);
    this.valueChange.emit(option.value);
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.visibleOptions();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.trigger?.nativeElement.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveHighlight(1, items.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveHighlight(-1, items.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = items[this.highlightIndex()];
      if (option) this.choose(option);
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onPointerDown(event: Event): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private moveHighlight(delta: number, length: number): void {
    if (length < 1) return;
    const next = (this.highlightIndex() + delta + length) % length;
    this.highlightIndex.set(next);
  }

  private indexOfValue(items: SearchableSelectOption[]): number {
    const idx = items.findIndex((o) => o.value === this.innerValue);
    return idx >= 0 ? idx : 0;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
