"use client";

import { Tx } from "@/components/bos/I18n";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/bos/Dialog";

export function ModalButtonVendor({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="admin-btn small" onClick={() => setOpen(true)}>
        <Tx>+ مورد</Tx>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="مورد جديد">
        {children}
      </Modal>
    </>
  );
}
