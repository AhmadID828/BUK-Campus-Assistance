export function getPasswordRequirements(password) {
  return [
    { label: "At least 8 characters", valid: password.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /\d/.test(password) },
    { label: "One symbol", valid: /[^A-Za-z0-9]/.test(password) },
    {
      label: "No more than 72 UTF-8 bytes",
      valid: new TextEncoder().encode(password).length <= 72,
    },
  ];
}

export function isStrongPassword(password) {
  return getPasswordRequirements(password).every((requirement) => requirement.valid);
}
