import type { IdOwner } from "@/lib/patients";
import { Checkbox } from "./fields";

// Shown under the ID number when it is already on another client's record:
// ticking it and saving again uses that record.
export function IdOwnerConfirm({ owner }: { owner?: IdOwner }) {
  if (!owner) return null;
  return (
    <div className="alert alert-info sm:col-span-2">
      <Checkbox name="confirmIdOwner" value={owner.id} label={<>Yes, this is <strong>{owner.name}</strong>. Use their record. The name on file stays as it is.</>} />
    </div>
  );
}
