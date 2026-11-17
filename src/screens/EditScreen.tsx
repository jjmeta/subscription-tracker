import { useMemo, useState, type FormEvent } from 'react';
import { Stepper, Switch, type ConfirmRequest } from '../components/ui';
import { parseYMD } from '../domain/dates';
import { formatLongDate, relativeLabel } from '../domain/dates';
import { createId, subscriptionFromDraft } from '../domain/draft';
import { billingDayNote, isMonthBased, nextOccurrence } from '../domain/schedule';
import type { BillingCycle, CycleUnit, Subscription } from '../domain/types';
import { CATEGORIES, CURRENCIES } from '../domain/types';
import { useAppState } from '../state/AppState';

const CATEGORY_LIST = CATEGORIES as readonly string[];
const CURRENCY_LIST = CURRENCIES as readonly string[];

type DraftState = {
  name: string;
  amount: string;
  currencyChoice: string;
  customCurrency: string;
  cycleKind: BillingCycle['kind'];
  every: string;
  unit: CycleUnit;
  renewalDate: string;
  categoryChoice: string;
  customCategory: string;
  paymentMethod: string;
  notes: string;
  status: Subscription['status'];
  useDefaultLead: boolean;
  leadDays: string;
};

function blankDraft(defaultLead: number): DraftState {
  return {
    name: '',
    amount: '',
    currencyChoice: 'AUD',
    customCurrency: '',
    cycleKind: 'monthly',
    every: '14',
    unit: 'days',
    renewalDate: '',
    categoryChoice: 'General',
    customCategory: '',
    paymentMethod: '',
    notes: '',
    status: 'active',
    useDefaultLead: true,
    leadDays: String(defaultLead),
  };
}

function fromSubscription(subscription: Subscription): DraftState {
  const custom = subscription.cycle.kind === 'custom' ? subscription.cycle : null;
  return {
    name: subscription.name,
    amount: subscription.amount.toFixed(subscription.currency === 'JPY' ? 0 : 2),
    currencyChoice: CURRENCY_LIST.includes(subscription.currency) ? subscription.currency : 'OTHER',
    customCurrency: CURRENCY_LIST.includes(subscription.currency) ? '' : subscription.currency,
    cycleKind: subscription.cycle.kind,
    every: custom ? String(custom.every) : '14',
    unit: custom ? custom.unit : 'days',
    renewalDate: subscription.nextRenewal,
    categoryChoice: CATEGORY_LIST.includes(subscription.category) ? subscription.category : 'Custom',
    customCategory: CATEGORY_LIST.includes(subscription.category) ? '' : subscription.category,
    paymentMethod: subscription.paymentMethod,
    notes: subscription.notes,
    status: subscription.status,
    useDefaultLead: subscription.reminderLeadDays == null,
    leadDays: String(subscription.reminderLeadDays ?? 3),
  };
}

export function EditScreen({
  existing,
  ask,
  onClose,
  onSaved,
}: {
  existing: Subscription | null;
  ask: (request: ConfirmRequest) => void;
  onClose: () => void;
  onSaved: (subscription: Subscription) => void;
}) {
  const { settings, today, save } = useAppState();
  const [draft, setDraft] = useState<DraftState>(() => (existing ? fromSubscription(existing) : blankDraft(settings.defaultLeadDays)));
  const [initial] = useState(() => JSON.stringify(draft));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useMemo(() => existing?.id ?? createId(), [existing?.id]);
  const dirty = JSON.stringify(draft) !== initial;

  const patch = (partial: Partial<DraftState>) => setDraft((current) => ({ ...current, ...partial }));

  const currency = draft.currencyChoice === 'OTHER' ? draft.customCurrency : draft.currencyChoice;
  const category = draft.categoryChoice === 'Custom' ? draft.customCategory : draft.categoryChoice;
  const cycle = useMemo<BillingCycle | null>(() => {
    if (draft.cycleKind !== 'custom') return { kind: draft.cycleKind };
    const every = Number(draft.every);
    if (!Number.isInteger(every) || every < 1) return null;
    return { kind: 'custom', every, unit: draft.unit };
  }, [draft.cycleKind, draft.every, draft.unit]);

  const anchorPreview =
    existing && draft.renewalDate === existing.nextRenewal ? existing.anchorDate : draft.renewalDate;
  let preview: string | null = null;
  if (cycle && parseYMD(anchorPreview) && parseYMD(today)) {
    try {
      preview = nextOccurrence(anchorPreview, cycle, today);
    } catch {
      preview = null;
    }
  }
  const scheduleNote = cycle && parseYMD(anchorPreview) && isMonthBased(cycle) ? billingDayNote(cycle, anchorPreview) : null;

  const close = () => {
    if (!dirty) {
      onClose();
      return;
    }
    ask({
      title: 'Discard changes?',
      message: 'Your edits will not be saved.',
      actions: [{ label: 'Discard', tone: 'danger', onClick: onClose }],
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty && existing) {
      onClose();
      return;
    }
    const result = subscriptionFromDraft(
      {
        id,
        name: draft.name,
        amount: draft.amount,
        currency,
        cycleKind: draft.cycleKind,
        every: draft.every,
        unit: draft.unit,
        renewalDate: draft.renewalDate,
        existingAnchorDate: existing?.anchorDate ?? null,
        existingNextRenewal: existing?.nextRenewal ?? null,
        category,
        paymentMethod: draft.paymentMethod,
        notes: draft.notes,
        status: existing ? draft.status : 'active',
        useDefaultLead: draft.useDefaultLead,
        leadDays: draft.leadDays,
        createdAt: existing?.createdAt ?? null,
      },
      today,
      new Date().toISOString(),
    );
    if (!result.ok) {
      setErrors(result.errors);
      setFormError('Check the highlighted fields.');
      return;
    }
    setSaving(true);
    setErrors({});
    setFormError(null);
    const ok = await save(result.subscription);
    if (ok) onSaved(result.subscription);
    else setSaving(false);
  };

  return (
    <div className="editor-scrim">
      <div className="editor">
        <form onSubmit={(event) => void onSubmit(event)}>
          <div className="editor-bar">
            <button type="button" className="text-btn left" onClick={close}>
              Cancel
            </button>
            <h2>{existing ? 'Edit' : 'New'}</h2>
            <button type="submit" className="text-btn right" disabled={saving}>
              {saving ? 'Saving' : 'Save'}
            </button>
          </div>
          {formError ? <p className="form-error">{formError}</p> : null}
          <section className="section">
            <div className="group">
              <label className="field">
                <span>Name</span>
                <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} autoComplete="off" autoCapitalize="words" maxLength={80} required />
              </label>
              {errors.name ? <p className="field-error">{errors.name}</p> : null}
            </div>
          </section>
          <section className="section">
            <h2 className="section-label">Price</h2>
            <div className="group">
              <label className="field">
                <span>Amount</span>
                <input
                  value={draft.amount}
                  onChange={(event) => patch({ amount: event.target.value })}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.amount)}
                />
              </label>
              {errors.amount ? <p className="field-error">{errors.amount}</p> : null}
              <label className="field">
                <span>Currency</span>
                <select value={draft.currencyChoice} onChange={(event) => patch({ currencyChoice: event.target.value })}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                  <option value="OTHER">Other</option>
                </select>
              </label>
              {draft.currencyChoice === 'OTHER' ? (
                <label className="field">
                  <span>Code</span>
                  <input
                    value={draft.customCurrency}
                    onChange={(event) => patch({ customCurrency: event.target.value.toUpperCase() })}
                    maxLength={3}
                    autoCapitalize="characters"
                    placeholder="USD"
                  />
                </label>
              ) : null}
              {errors.currency ? <p className="field-error">{errors.currency}</p> : null}
            </div>
          </section>
          <section className="section">
            <h2 className="section-label">Schedule</h2>
            <div className="group">
              <label className="field">
                <span>Cycle</span>
                <select value={draft.cycleKind} onChange={(event) => patch({ cycleKind: event.target.value as BillingCycle['kind'] })}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {draft.cycleKind === 'custom' ? (
                <label className="field">
                  <span>Every</span>
                  <input value={draft.every} onChange={(event) => patch({ every: event.target.value })} inputMode="numeric" aria-invalid={Boolean(errors.cycle)} />
                  <select className="unit" value={draft.unit} onChange={(event) => patch({ unit: event.target.value as CycleUnit })}>
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                  </select>
                </label>
              ) : null}
              {errors.cycle ? <p className="field-error">{errors.cycle}</p> : null}
              <label className="field">
                <span>Next renewal</span>
                <input type="date" value={draft.renewalDate} onChange={(event) => patch({ renewalDate: event.target.value })} required />
              </label>
              {errors.renewalDate ? <p className="field-error">{errors.renewalDate}</p> : null}
            </div>
            <p className="section-foot">
              {preview && preview !== draft.renewalDate
                ? `Next charge is ${formatLongDate(preview)} (${relativeLabel(today, preview)}). `
                : 'After this date passes, the next charge moves forward on its own. '}
              {scheduleNote ? `${scheduleNote}.` : ''}
            </p>
          </section>
          <section className="section">
            <h2 className="section-label">Details</h2>
            <div className="group">
              <label className="field">
                <span>Category</span>
                <select value={draft.categoryChoice} onChange={(event) => patch({ categoryChoice: event.target.value })}>
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </label>
              {draft.categoryChoice === 'Custom' ? (
                <label className="field">
                  <span>Custom</span>
                  <input value={draft.customCategory} onChange={(event) => patch({ customCategory: event.target.value })} maxLength={40} />
                </label>
              ) : null}
              {errors.category ? <p className="field-error">{errors.category}</p> : null}
              <label className="field">
                <span>Payment</span>
                <input
                  value={draft.paymentMethod}
                  onChange={(event) => patch({ paymentMethod: event.target.value })}
                  placeholder="Card, PayPal…"
                  maxLength={40}
                  autoComplete="off"
                />
              </label>
              {errors.paymentMethod ? <p className="field-error">{errors.paymentMethod}</p> : null}
            </div>
          </section>
          <section className="section">
            <h2 className="section-label">Reminder</h2>
            <div className="group">
              <Switch
                checked={draft.useDefaultLead}
                label={`Use the default (${settings.defaultLeadDays} day${settings.defaultLeadDays === 1 ? '' : 's'})`}
                onChange={(useDefaultLead) => patch({ useDefaultLead })}
              />
              {draft.useDefaultLead ? null : (
                <div className="field">
                  <span>Days before</span>
                  <Stepper
                    label="Days before"
                    min={0}
                    max={60}
                    value={Number(draft.leadDays) || 0}
                    onChange={(value) => patch({ leadDays: String(value) })}
                  />
                </div>
              )}
            </div>
            <p className="section-foot">0 means the calendar alert fires at 9:00am on the renewal day.</p>
          </section>
          <section className="section">
            <h2 className="section-label">Notes</h2>
            <div className="group">
              <label className="notes">
                <textarea value={draft.notes} onChange={(event) => patch({ notes: event.target.value })} maxLength={2000} rows={4} />
              </label>
              {errors.notes ? <p className="field-error">{errors.notes}</p> : null}
            </div>
          </section>
          {existing ? (
            <section className="section">
              <h2 className="section-label">Status</h2>
              <div className="group pad">
                <div className="segmented" role="radiogroup" aria-label="Status">
                  <button type="button" role="radio" aria-checked={draft.status === 'active'} onClick={() => patch({ status: 'active' })}>
                    Active
                  </button>
                  <button type="button" role="radio" aria-checked={draft.status === 'cancelled'} onClick={() => patch({ status: 'cancelled' })}>
                    Cancelled
                  </button>
                </div>
              </div>
            </section>
          ) : null}
          <div className="editor-end" />
        </form>
      </div>
    </div>
  );
}
