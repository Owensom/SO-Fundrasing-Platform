"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function RegisterForm() {
  const formRef = useRef<HTMLFormElement | null>(null);

  const [organisationName, setOrganisationName] = useState("");
  const [manualSlug, setManualSlug] = useState("");
  const [hasEditedSlug, setHasEditedSlug] = useState(false);

  useEffect(() => {
    function resetForm() {
      setOrganisationName("");
      setManualSlug("");
      setHasEditedSlug(false);
      formRef.current?.reset();
    }

    resetForm();

    window.addEventListener("pageshow", resetForm);

    return () => {
      window.removeEventListener("pageshow", resetForm);
    };
  }, []);

  const generatedSlug = useMemo(
    () => slugify(organisationName),
    [organisationName],
  );

  const tenantSlug = hasEditedSlug ? slugify(manualSlug) : generatedSlug;

  function updateOrganisationName(value: string) {
    setOrganisationName(value);

    if (!hasEditedSlug) {
      setManualSlug(slugify(value));
    }
  }

  function updateTenantSlug(value: string) {
    setHasEditedSlug(true);
    setManualSlug(slugify(value));
  }

  return (
    <form
      ref={formRef}
      action="/api/admin/register"
      method="post"
      autoComplete="off"
      style={styles.form}
    >
      <label style={styles.label}>
        Organisation name
        <input
          name="organisationName"
          required
          value={organisationName}
          onChange={(event) => updateOrganisationName(event.target.value)}
          placeholder="Brave Ceilidh"
          autoComplete="off"
          spellCheck={false}
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Site slug
        <input
          name="tenantSlug"
          required
          value={tenantSlug}
          onChange={(event) => updateTenantSlug(event.target.value)}
          placeholder="brave-ceilidh"
          pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]"
          autoComplete="off"
          spellCheck={false}
          style={styles.input}
        />
        <span style={styles.helpText}>
          This becomes the tenant identifier, for example{" "}
          <strong>{tenantSlug || "brave-ceilidh"}</strong>.
        </span>
      </label>

      <label style={styles.label}>
        Admin name
        <input
          name="adminName"
          required
          placeholder="Organisation Admin"
          autoComplete="off"
          spellCheck={false}
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Admin email
        <input
          name="email"
          type="email"
          required
          placeholder="admin@example.org"
          autoComplete="off"
          spellCheck={false}
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={10}
          placeholder="At least 10 characters"
          autoComplete="new-password"
          style={styles.input}
        />
      </label>

      <label style={styles.label}>
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          placeholder="Repeat password"
          autoComplete="new-password"
          style={styles.input}
        />
      </label>

      <button type="submit" style={styles.submitButton}>
        Create organisation account
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "grid",
    gap: 12,
  },

  label: {
    display: "grid",
    gap: 6,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },

  input: {
    width: "100%",
    height: 48,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },

  helpText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 650,
  },

  submitButton: {
    marginTop: 8,
    height: 52,
    border: "none",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 16px 32px rgba(37,99,235,0.24)",
  },
};
