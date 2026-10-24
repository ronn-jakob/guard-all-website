import ConfirmPasswordDialog from "../../components/ConfirmPasswordDialog.jsx";

// Wraps the shared password confirmation with the copy specific to deleting a
// draft job. Renders nothing until a job has been chosen for deletion.
export default function DeleteDraftJobDialog({
  jobNumber,
  isBusy,
  error,
  onCancel,
  onConfirm,
}) {
  if (!jobNumber) return null;

  return (
    <ConfirmPasswordDialog
      title="Delete draft job"
      message={`Delete ${jobNumber}? Its draft quotation and technician assignments will be removed too.`}
      detail="Only a draft can be deleted. Once a job is confirmed it must be cancelled instead, so its history stays intact."
      confirmLabel="Delete draft"
      busyLabel="Deleting..."
      isBusy={isBusy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
