"use client";

import { Tx } from "@/components/bos/I18n";

import { useTransition } from "react";
import { ActionButton, ConfirmButton, ModalButton } from "@/components/bos/Dialog";
import { ActionForm, SubmitButton } from "@/components/bos/Form";
import { EntitySelector } from "@/components/bos/EntitySelector";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { invitePortalUserAction, setPortalUserStatusAction, archiveAccountAction, archiveContactAction, mergeAccountAction, setPrimaryContactAction, startOnboardingAction, toggleOnboardingItemAction } from "../actions";

export function ArchiveAccountButton({ id, archived }: { id: string; archived: boolean }) {
  return archived ? (
    <ActionButton label="استعادة" className="admin-btn small secondary" action={() => archiveAccountAction(id, false)} />
  ) : (
    <ConfirmButton label="أرشفة" className="admin-btn small danger" message="أرشفة الحساب؟ لا يمكن أرشفة حساب لديه صفقات مفتوحة أو مشاريع نشطة، وسيتم تعطيل وصول بوابة العميل." confirmLabel="أرشفة" action={() => archiveAccountAction(id, true)} />
  );
}

export function MergeAccountButton({ id, name }: { id: string; name: string }) {
  return (
    <ModalButton label="دمج" title={<Tx vars={{ name }}>{"دمج «{name}» في حساب آخر"}</Tx>} className="admin-btn small secondary">
      {() => (
        <ActionForm action={mergeAccountAction.bind(null, id)}>
          <p className="bos-faint" style={{ fontSize: 13 }}>
            <Tx>سيتم نقل كل جهات الاتصال والصفقات والمشاريع والعقود والفواتير والدفعات والتذاكر والملفات والسجل الزمني إلى الحساب الهدف، ثم أرشفة هذا الحساب. العملية مسجلة في سجل التدقيق ولا يمكن التراجع عنها تلقائياً.</Tx>
          </p>
          <div className="bos-field">
            <label><Tx>الحساب الهدف</Tx></label>
            <EntitySelector name="target" required search={async (q) => (await searchEntitiesAction("client", q)).filter((o) => o.id !== id)} placeholder="ابحث عن الحساب الذي سيبقى..." />
          </div>
          <div className="bos-form-actions">
            <SubmitButton label="دمج نهائي" className="admin-btn danger" pendingLabel="جارٍ الدمج..." />
          </div>
        </ActionForm>
      )}
    </ModalButton>
  );
}

export function PrimaryContactButton({ clientId, contactId }: { clientId: string; contactId: string }) {
  return <ActionButton label="جعلها رئيسية" className="admin-btn small ghost" action={() => setPrimaryContactAction(clientId, contactId)} />;
}

export function ArchiveContactButton({ id, archived }: { id: string; archived: boolean }) {
  return archived ? (
    <ActionButton label="استعادة" className="admin-btn small ghost" action={() => archiveContactAction(id, false)} />
  ) : (
    <ConfirmButton label="أرشفة" className="admin-btn small ghost" message="أرشفة جهة الاتصال؟ يبقى سجلها التاريخي مرتبطاً بالحساب، ويُعطّل وصولها لبوابة العميل." confirmLabel="أرشفة" action={() => archiveContactAction(id, true)} />
  );
}

export function StartOnboardingButton({ clientId, dealId, label }: { clientId: string; dealId: string; label: string }) {
  return <ActionButton label={label} className="admin-btn small secondary" action={() => startOnboardingAction(clientId, dealId)} />;
}

export function OnboardingItemToggle({ clientId, itemId, done, auto, disabled }: { clientId: string; itemId: string; done: boolean; auto: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      checked={done}
      disabled={disabled || pending || (auto && done)}
      title={auto ? "يكتمل تلقائياً من النظام، ويمكن تأكيده يدوياً" : undefined}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => {
          const r = await toggleOnboardingItemAction(clientId, itemId, next);
          if (!r.ok) alert(r.error);
        });
      }}
    />
  );
}

export function InvitePortalButton({ clientId, contactId, label = "دعوة للبوابة" }: { clientId: string; contactId: string; label?: string }) {
  return <ConfirmButton label={label} className="admin-btn small ghost" message="سيتم إنشاء حساب بوابة لجهة الاتصال وإرسال رابط تعيين كلمة المرور إلى بريدها." confirmLabel="إرسال الدعوة" action={() => invitePortalUserAction(clientId, contactId)} />;
}

export function PortalUserStatusButton({ clientId, portalUserId, status }: { clientId: string; portalUserId: string; status: string }) {
  return status === "disabled" ? (
    <ActionButton label="تفعيل" className="admin-btn small ghost" action={() => setPortalUserStatusAction(clientId, portalUserId, "active")} />
  ) : (
    <ConfirmButton label="تعطيل" className="admin-btn small ghost" message="تعطيل وصول هذا المستخدم للبوابة وإنهاء جلساته؟" action={() => setPortalUserStatusAction(clientId, portalUserId, "disabled")} />
  );
}
