// Browsers ignore autocomplete="off" on password fields, and password managers
// follow their own markers. The shared tablet must never offer saved logins or
// fill a staff member's own details into someone else's record.
export const NO_PASSWORD_MANAGER = { "data-1p-ignore": true, "data-lpignore": "true", "data-bwignore": true, "data-form-type": "other" };
