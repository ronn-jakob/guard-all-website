import { callAuthFunction } from "../auth.js";

// Billing actions used by Sales & Billing and the invoice composer. The action
// names are kept here so the screens never spell them out.
export const BILLING_ACTIONS = Object.freeze({
  listInvoices: "list-invoices",
  listCandidates: "list-invoice-candidates",
  createInvoice: "create-invoice",
  recordPayment: "record-payment",
});

export function listInvoices() {
  return callAuthFunction(BILLING_ACTIONS.listInvoices);
}

export function listInvoiceCandidates() {
  return callAuthFunction(BILLING_ACTIONS.listCandidates);
}

export function createInvoice(payload) {
  return callAuthFunction(BILLING_ACTIONS.createInvoice, payload);
}

export function recordPayment(payload) {
  return callAuthFunction(BILLING_ACTIONS.recordPayment, payload);
}
