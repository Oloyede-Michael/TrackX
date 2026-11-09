import { q } from '../db.js';

export function audit(admin, { action, entity, entityId, oldValue, newValue, reason }) {
  return q(
    `INSERT INTO audit_logs (admin_id, admin_name, action, entity, entity_id, old_value, new_value, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [admin?.id ?? null, admin?.name ?? 'System', action, entity, entityId ?? null,
     oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null, reason ?? null]
  );
}
