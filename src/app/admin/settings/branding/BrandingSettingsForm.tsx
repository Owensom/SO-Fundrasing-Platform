"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";

type BrandingFormState = {
  displayName: string;
  tagline: string;
  contactName: string;
  contactEmail: string;
  contactEmailVerificationStatus: string;
  contactEmailVerificationSentAt: string;
  contactEmailVerifiedAt: string;
  contactEmailVerificationError: string;
  logoUrl: string;
  logoMarkUrl: string;
  primaryColour: string;
  accentColour: string;
  footerText: string;
};

type Props = {
  tenantSlug: string;
  subscriptionLabel: string;
  saved: boolean;
  error: string;
  contactTest: string;
  canUseAdvancedBranding: boolean;
  formState: BrandingFormState;
  updateAction: (formData: FormData) => void | Promise<void>;
  sendContactEmailTestAction: (formData: FormData) => void | Promise<void>;
};

const COLOUR_PRESETS = [
  { label: "SO Blue", value: "#1683F8" },
  { label: "Gold", value: "#FACC15" },
  { label: "Navy", value: "#0F172A" },
  { label: "Royal Blue", value: "#2563EB" },
  { label: "Sky Blue", value: "#38BDF8" },
  { label: "Emerald", value: "#10B981" },
  { label: "Forest Green", value: "#166534" },
  { label: "Purple", value: "#7C3AED" },
  { label: "Rose", value: "#E11D48" },
  { label: "Orange", value: "#F97316" },
  { label: "Slate", value: "#475569" },
  { label: "Black", value: "#020617" },
  { label: "White", value: "#FFFFFF" },
];

const COLOUR_NAME_MAP: Record<string, string> = {
  blue: "#1683F8",
  "so blue": "#1683F8",
  gold: "#FACC15",
  yellow: "#FACC15",
  navy: "#0F172A",
  "dark blue": "#0F172A",
  "royal blue": "#2563EB",
  "sky blue": "#38BDF8",
  green: "#10B981",
  emerald: "#10B981",
  "forest green": "#166534",
  purple: "#7C3AED",
  rose: "#E11D48",
  red: "#DC2626",
  orange: "#F97316",
  slate: "#475569",
  grey: "#64748B",
  gray: "#64748B",
  black: "#020617",
  white: "#FFFFFF",
};

function normaliseHex(value: string) {
  const clean = String(value || "").trim().toUpperCase();

  if (/^#[0-9A-F]{6}$/.test(clean)) {
    return clean;
  }

  if (/^[0-9A-F]{6}$/.test(clean)) {
    return `#${clean}`;
  }

  return "";
}

function resolveColourInput(value: string, fallback: string) {
  const clean = String(value || "").trim();

  if (!clean) return fallback;

  const hex = normaliseHex(clean);

  if (hex) return hex;

  const named = COLOUR_NAME_MAP[clean.toLowerCase()];

  if (named) return named;

  return fallback;
}

function cleanInitialColour(value: string, fallback: string) {
  return normaliseHex(value) || fallback;
}

function getPresetValue(hex: string) {
  const match = COLOUR_PRESETS.find(
    (preset) => preset.value.toUpperCase() === hex.toUpperCase(),
  );

  return match?.value || "custom";
}

function formatDateTime(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "Not recorded";

  const date = new Date(clean.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return clean;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatStatusLabel(value: string) {
  const clean = String(value || "").trim();

  if (!clean) return "Not tested yet";

  return clean
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getErrorMessage(error: string) {
  if (error === "invalid_contact_email") {
    return {
      title: "Contact email was not saved",
      text: "Please enter a valid public contact email address, or leave the field blank.",
    };
  }

  return null;
}

function getContactTestMessage(contactTest: string) {
  if (contactTest === "sent") {
    return {
      tone: "success" as const,
      title: "Test email sent",
      text: "A branded test email has been sent to the saved public contact email address.",
    };
  }

  if (contactTest === "missing_contact_email") {
    return {
      tone: "warning" as const,
      title: "No contact email saved",
      text: "Save a valid public contact email address before sending a test email.",
    };
  }

  if (contactTest === "missing_settings") {
    return {
      tone: "error" as const,
      title: "Settings could not be loaded",
      text: "The tenant branding settings could not be found. Please refresh and try again.",
    };
  }

  if (contactTest === "email_failed") {
    return {
      tone: "error" as const,
      title: "Test email could not be sent",
      text: "The test email could not be sent. Check the contact address and email service settings, then try again.",
    };
  }

  return null;
}

function getVerificationStatusMessage({
  contactEmail,
  status,
  sentAt,
  verifiedAt,
  error,
}: {
  contactEmail: string;
  status: string;
  sentAt: string;
  verifiedAt: string;
  error: string;
}) {
  if (!contactEmail) {
    return {
      tone: "neutral" as const,
      title: "No public contact email saved",
      text: "Save a public contact email before sending a branded test email.",
    };
  }

  if (status === "verified") {
    return {
      tone: "success" as const,
      title: "Contact email verified",
      text: verifiedAt
        ? `Verified on ${formatDateTime(verifiedAt)}.`
        : "This public contact email has been marked as verified.",
    };
  }

  if (status === "sent") {
    return {
      tone: "success" as const,
      title: "Test email sent",
      text: sentAt
        ? `Last test email sent on ${formatDateTime(sentAt)}.`
        : "A branded test email has been sent to this address.",
    };
  }

  if (status === "failed") {
    return {
      tone: "error" as const,
      title: "Last test email failed",
      text:
        error ||
        "The last test email could not be sent. Check the contact address and email service settings.",
    };
  }

  return {
    tone: "warning" as const,
    title: "Contact email not tested yet",
    text: "Send a branded test email to confirm this address can receive public supporter messages.",
  };
}

export default function BrandingSettingsForm({
  tenantSlug,
  subscriptionLabel,
  saved,
  error,
  contactTest,
  canUseAdvancedBranding,
  formState,
  updateAction,
  sendContactEmailTestAction,
}: Props) {
  const [displayName, setDisplayName] = useState(formState.displayName);
  const [tagline, setTagline] = useState(formState.tagline);
  const [contactName, setContactName] = useState(formState.contactName);
  const [contactEmail, setContactEmail] = useState(formState.contactEmail);
  const [logoUrl, setLogoUrl] = useState(formState.logoUrl);
  const [logoMarkUrl, setLogoMarkUrl] = useState(formState.logoMarkUrl);

  const errorMessage = getErrorMessage(error);
  const contactTestMessage = getContactTestMessage(contactTest);
  const verificationStatusMessage = getVerificationStatusMessage({
    contactEmail: formState.contactEmail,
    status: formState.contactEmailVerificationStatus,
    sentAt: formState.contactEmailVerificationSentAt,
    verifiedAt: formState.contactEmailVerifiedAt,
    error: formState.contactEmailVerificationError,
  });

  const [primaryColour, setPrimaryColour] = useState(
    cleanInitialColour(formState.primaryColour, "#1683F8"),
  );
  const [accentColour, setAccentColour] = useState(
    cleanInitialColour(formState.accentColour, "#FACC15"),
  );

  const [primaryColourText, setPrimaryColourText] = useState(
    cleanInitialColour(formState.primaryColour, "#1683F8"),
  );
  const [accentColourText, setAccentColourText] = useState(
    cleanInitialColour(formState.accentColour, "#FACC15"),
  );

  const [footerText, setFooterText] = useState(formState.footerText);
  const [logoUploading, setLogoUploading] = useState(false);
  const [markUploading, setMarkUploading] = useState(false);

  function updatePrimaryColour(value: string) {
    const next = resolveColourInput(value, primaryColour);

    setPrimaryColour(next);
    setPrimaryColourText(value);
  }

  function commitPrimaryColour(value: string) {
    const next = resolveColourInput(value, primaryColour);

    setPrimaryColour(next);
    setPrimaryColourText(next);
  }

  function updateAccentColour(value: string) {
    const next = resolveColourInput(value, accentColour);

    setAccentColour(next);
    setAccentColourText(value);
  }

  function commitAccentColour(value: string) {
    const next = resolveColourInput(value, accentColour);

    setAccentColour(next);
    setAccentColourText(next);
  }

  async function uploadBrandImage(file: File, target: "logo" | "mark") {
    if (!canUseAdvancedBranding) {
      alert("Logo uploads require advanced branding.");
      return;
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !preset) {
      alert("Cloudinary settings are missing.");
      return;
    }

    if (target === "logo") {
      setLogoUploading(true);
    } else {
      setMarkUploading(true);
    }

    try {
      const uploadFormData = new FormData();

      uploadFormData.append("file", file);
      uploadFormData.append("upload_preset", preset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: uploadFormData,
        },
      );

      const data = await response.json();

      if (!response.ok || !data.secure_url) {
        console.error(data);
        alert("Image upload failed.");
        return;
      }

      if (target === "logo") {
        setLogoUrl(String(data.secure_url));
      } else {
        setLogoMarkUrl(String(data.secure_url));
      }
    } catch (uploadError) {
      console.error(uploadError);
      alert("Upload error.");
    } finally {
      if (target === "logo") {
        setLogoUploading(false);
      } else {
        setMarkUploading(false);
      }
    }
  }

  return (
    <main className="branding-settings-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="branding-hero" style={styles.hero}>
        <div style={styles.heroCopy}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Tenant branding</span>
            <span style={styles.softBadge}>{subscriptionLabel}</span>
          </div>

          <h1 className="so-brand-heading branding-title" style={styles.title}>
            Branding settings
          </h1>

          <p style={styles.subtitle}>
            Set the public name, contact details and messaging for this tenant.
            Upload a logo and choose brand colours when advanced branding is
            available.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.heroPanel}>
          <p style={styles.heroPanelEyebrow}>Brand preview</p>

          <div style={styles.previewLogoWrap}>
            {logoMarkUrl || logoUrl ? (
              <img
                src={logoMarkUrl || logoUrl}
                alt={displayName || tenantSlug}
                style={styles.previewLogo}
              />
            ) : (
              <span style={styles.previewLogoFallback}>
                {(displayName || tenantSlug).slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <h2 style={styles.heroPanelTitle}>{displayName || tenantSlug}</h2>

          <p style={styles.heroPanelText}>
            {tagline || "Your public tenant tagline will appear here."}
          </p>

          <p style={styles.heroPanelContact}>
            {contactEmail
              ? `Public contact: ${contactName || displayName || tenantSlug}`
              : "Public contact email is not set yet."}
          </p>

          <p style={styles.heroPanelContact}>
            Contact test:{" "}
            {formatStatusLabel(formState.contactEmailVerificationStatus)}
          </p>

          <div style={styles.colourPreviewRow}>
            <span
              style={{
                ...styles.colourPreview,
                background: primaryColour,
              }}
            />
            <span
              style={{
                ...styles.colourPreview,
                background: accentColour,
              }}
            />
          </div>
        </div>
      </section>

      {saved ? (
        <section style={styles.successCard}>
          <strong>Branding settings saved.</strong>
          <span>
            The tenant branding and public contact details have been updated.
          </span>
        </section>
      ) : null}

      {errorMessage ? (
        <section style={styles.errorCard}>
          <strong>{errorMessage.title}</strong>
          <span>{errorMessage.text}</span>
        </section>
      ) : null}

      {contactTestMessage ? (
        <section
          style={{
            ...styles.testStatusCard,
            ...(contactTestMessage.tone === "success"
              ? styles.testStatusSuccess
              : contactTestMessage.tone === "warning"
                ? styles.testStatusWarning
                : styles.testStatusError),
          }}
        >
          <strong>{contactTestMessage.title}</strong>
          <span>{contactTestMessage.text}</span>
        </section>
      ) : null}

      <section className="settings-grid" style={styles.settingsGrid}>
        <section className="form-card" style={styles.formCard}>
          <p style={styles.kicker}>Public identity</p>

          <h2 style={styles.sectionTitle}>Basic branding</h2>

          <p style={styles.sectionText}>
            These details are used across the public campaign hub and public
            tenant pages. Public contact details will be used for supporter
            contact forms.
          </p>

          <form action={updateAction} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>Public display name</span>
              <input
                name="public_display_name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Example: Brave Ceilidh"
                maxLength={90}
                style={styles.input}
              />
              <span style={styles.hint}>
                Included for all tenants. Leave blank to use the tenant slug.
              </span>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Short tagline</span>
              <input
                name="public_tagline"
                value={tagline}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Example: Fundraising for local causes"
                maxLength={180}
                style={styles.input}
              />
              <span style={styles.hint}>
                Included for all tenants. Keep this short and public-facing.
              </span>
            </label>

            <section style={styles.contactPanel}>
              <div style={styles.panelIntro}>
                <p style={styles.contactKicker}>Public contact</p>
                <h2 style={styles.contactTitle}>Supporter contact details</h2>
                <p style={styles.contactText}>
                  These fields will be used by the public customer-to-tenant
                  contact page. They do not affect platform-owner support
                  emails.
                </p>
              </div>

              <label style={styles.field}>
                <span style={styles.label}>Public contact name</span>
                <input
                  name="public_contact_name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Example: Events team, Fundraising team, Jane Smith"
                  maxLength={120}
                  style={styles.input}
                />
                <span style={styles.hint}>
                  Optional. This can be a person, team or organisation contact
                  label.
                </span>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Public contact email</span>
                <input
                  name="public_contact_email"
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="Example: hello@example.org"
                  maxLength={254}
                  style={styles.input}
                />
                <span style={styles.hint}>
                  Public supporter contact messages will go to this address.
                  Leave blank until the tenant is ready to receive messages.
                </span>
              </label>

              <section
                className="verification-card"
                style={{
                  ...styles.verificationCard,
                  ...(verificationStatusMessage.tone === "success"
                    ? styles.verificationSuccess
                    : verificationStatusMessage.tone === "error"
                      ? styles.verificationError
                      : verificationStatusMessage.tone === "warning"
                        ? styles.verificationWarning
                        : styles.verificationNeutral),
                }}
              >
                <div style={styles.panelIntro}>
                  <p style={styles.verificationKicker}>
                    Contact email test status
                  </p>
                  <h3 style={styles.verificationTitle}>
                    {verificationStatusMessage.title}
                  </h3>
                  <p style={styles.verificationText}>
                    {verificationStatusMessage.text}
                  </p>
                </div>

                <div className="verification-grid" style={styles.verificationGrid}>
                  <SummaryItem
                    label="Saved status"
                    value={formatStatusLabel(
                      formState.contactEmailVerificationStatus,
                    )}
                  />
                  <SummaryItem
                    label="Last test sent"
                    value={
                      formState.contactEmailVerificationSentAt
                        ? formatDateTime(
                            formState.contactEmailVerificationSentAt,
                          )
                        : "Not sent"
                    }
                  />
                  <SummaryItem
                    label="Verified at"
                    value={
                      formState.contactEmailVerifiedAt
                        ? formatDateTime(formState.contactEmailVerifiedAt)
                        : "Not manually verified"
                    }
                  />
                  <SummaryItem
                    label="Last error"
                    value={formState.contactEmailVerificationError || "No error"}
                  />
                </div>
              </section>
            </section>

            <div style={styles.divider} />

            <div style={styles.advancedHeader}>
              <div style={styles.panelIntro}>
                <p style={styles.kicker}>Advanced branding</p>
                <h2 style={styles.sectionTitle}>Logo, colours and footer</h2>
              </div>

              <span
                style={{
                  ...styles.planPill,
                  ...(canUseAdvancedBranding
                    ? styles.planPillIncluded
                    : styles.planPillLocked),
                }}
              >
                {canUseAdvancedBranding ? "Available" : "Professional required"}
              </span>
            </div>

            <fieldset
              disabled={!canUseAdvancedBranding}
              style={{
                ...styles.fieldset,
                ...(!canUseAdvancedBranding ? styles.disabledFieldset : {}),
              }}
            >
              <section style={styles.uploadPanel}>
                <div style={styles.uploadHeader}>
                  <div style={styles.panelIntro}>
                    <h3 style={styles.uploadTitle}>Main logo</h3>
                    <p style={styles.uploadText}>
                      Upload a transparent PNG where possible, or paste an image
                      URL manually.
                    </p>
                  </div>

                  {logoUrl ? (
                    <div style={styles.uploadPreviewWrap}>
                      <img
                        src={logoUrl}
                        alt="Main logo preview"
                        style={styles.uploadPreview}
                      />
                    </div>
                  ) : null}
                </div>

                <label style={styles.uploadButton}>
                  {logoUploading ? "Uploading..." : "Upload logo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!canUseAdvancedBranding || logoUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        uploadBrandImage(file, "logo");
                      }
                    }}
                    style={styles.hiddenFileInput}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Logo URL</span>
                  <input
                    name="public_logo_url"
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    placeholder="/brand/example-logo.png or https://..."
                    style={styles.input}
                  />
                </label>
              </section>

              <section style={styles.uploadPanel}>
                <div style={styles.uploadHeader}>
                  <div style={styles.panelIntro}>
                    <h3 style={styles.uploadTitle}>Logo mark</h3>
                    <p style={styles.uploadText}>
                      Optional square/icon version for compact spaces.
                    </p>
                  </div>

                  {logoMarkUrl ? (
                    <div style={styles.uploadPreviewWrap}>
                      <img
                        src={logoMarkUrl}
                        alt="Logo mark preview"
                        style={styles.uploadPreview}
                      />
                    </div>
                  ) : null}
                </div>

                <label style={styles.uploadButton}>
                  {markUploading ? "Uploading..." : "Upload logo mark"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!canUseAdvancedBranding || markUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        uploadBrandImage(file, "mark");
                      }
                    }}
                    style={styles.hiddenFileInput}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Logo mark URL</span>
                  <input
                    name="public_logo_mark_url"
                    value={logoMarkUrl}
                    onChange={(event) => setLogoMarkUrl(event.target.value)}
                    placeholder="/brand/example-mark.png or https://..."
                    style={styles.input}
                  />
                </label>
              </section>

              <div className="colour-grid" style={styles.colourGrid}>
                <section style={styles.colourField}>
                  <span style={styles.label}>Primary colour</span>

                  <input
                    type="hidden"
                    name="public_primary_colour"
                    value={primaryColour}
                  />

                  <div style={styles.colourStack}>
                    <label style={styles.miniLabel}>
                      Quick choice
                      <select
                        value={getPresetValue(primaryColour)}
                        onChange={(event) => {
                          const next = event.target.value;

                          if (next === "custom") return;

                          setPrimaryColour(next);
                          setPrimaryColourText(next);
                        }}
                        style={styles.select}
                      >
                        {COLOUR_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                    </label>

                    <label style={styles.miniLabel}>
                      Type name or hex
                      <input
                        value={primaryColourText}
                        onChange={(event) =>
                          updatePrimaryColour(event.target.value)
                        }
                        onBlur={(event) =>
                          commitPrimaryColour(event.target.value)
                        }
                        placeholder="Blue, Gold, #1683F8"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.miniLabel}>
                      Click for custom colour
                      <div style={styles.colourControl}>
                        <input
                          type="color"
                          value={primaryColour}
                          onChange={(event) => {
                            const next = event.target.value.toUpperCase();

                            setPrimaryColour(next);
                            setPrimaryColourText(next);
                          }}
                          style={styles.colourPicker}
                        />

                        <span style={styles.colourValue}>{primaryColour}</span>
                      </div>
                    </label>
                  </div>
                </section>

                <section style={styles.colourField}>
                  <span style={styles.label}>Accent colour</span>

                  <input
                    type="hidden"
                    name="public_accent_colour"
                    value={accentColour}
                  />

                  <div style={styles.colourStack}>
                    <label style={styles.miniLabel}>
                      Quick choice
                      <select
                        value={getPresetValue(accentColour)}
                        onChange={(event) => {
                          const next = event.target.value;

                          if (next === "custom") return;

                          setAccentColour(next);
                          setAccentColourText(next);
                        }}
                        style={styles.select}
                      >
                        {COLOUR_PRESETS.map((preset) => (
                          <option key={preset.value} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                    </label>

                    <label style={styles.miniLabel}>
                      Type name or hex
                      <input
                        value={accentColourText}
                        onChange={(event) =>
                          updateAccentColour(event.target.value)
                        }
                        onBlur={(event) => commitAccentColour(event.target.value)}
                        placeholder="Gold, Navy, #FACC15"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.miniLabel}>
                      Click for custom colour
                      <div style={styles.colourControl}>
                        <input
                          type="color"
                          value={accentColour}
                          onChange={(event) => {
                            const next = event.target.value.toUpperCase();

                            setAccentColour(next);
                            setAccentColourText(next);
                          }}
                          style={styles.colourPicker}
                        />

                        <span style={styles.colourValue}>{accentColour}</span>
                      </div>
                    </label>
                  </div>
                </section>
              </div>

              <label style={styles.field}>
                <span style={styles.label}>Public footer wording</span>
                <input
                  name="public_footer_text"
                  value={footerText}
                  onChange={(event) => setFooterText(event.target.value)}
                  placeholder="Example: Supporting local community fundraising"
                  maxLength={180}
                  style={styles.input}
                />
              </label>
            </fieldset>

            {!canUseAdvancedBranding ? (
              <section style={styles.lockedNotice}>
                <strong>Advanced branding is not active on this plan.</strong>
                <span>
                  Display name, tagline and public contact details can be saved
                  now. Logos, colours and footer wording will remain unchanged
                  until advanced branding is available for this tenant.
                </span>
              </section>
            ) : null}

            <button type="submit" style={styles.primaryButton}>
              Save branding settings
            </button>
          </form>
        </section>

        <aside className="preview-card" style={styles.previewCard}>
          <p style={styles.kicker}>Current values</p>

          <div style={styles.summaryList}>
            <SummaryItem label="Display name" value={displayName || "Not set"} />
            <SummaryItem label="Tagline" value={tagline || "Not set"} />
            <SummaryItem label="Contact name" value={contactName || "Not set"} />
            <SummaryItem
              label="Contact email"
              value={contactEmail || "Not set"}
            />
            <SummaryItem
              label="Contact email status"
              value={formatStatusLabel(
                formState.contactEmailVerificationStatus,
              )}
            />
            <SummaryItem
              label="Last contact test"
              value={
                formState.contactEmailVerificationSentAt
                  ? formatDateTime(formState.contactEmailVerificationSentAt)
                  : "Not sent"
              }
            />
            <SummaryItem label="Logo URL" value={logoUrl || "Not set"} />
            <SummaryItem
              label="Logo mark URL"
              value={logoMarkUrl || "Not set"}
            />
            <SummaryItem label="Primary colour" value={primaryColour} />
            <SummaryItem label="Accent colour" value={accentColour} />
            <SummaryItem label="Footer text" value={footerText || "Not set"} />
          </div>

          <section style={styles.testEmailCard}>
            <div style={styles.panelIntro}>
              <p style={styles.testEmailKicker}>Contact email test</p>
              <h2 style={styles.testEmailTitle}>Send a branded test email</h2>
              <p style={styles.testEmailText}>
                This sends a test email to the saved public contact email
                address. Save the contact email first if you have just changed
                it.
              </p>
            </div>

            <section
              style={{
                ...styles.compactVerificationCard,
                ...(verificationStatusMessage.tone === "success"
                  ? styles.compactVerificationSuccess
                  : verificationStatusMessage.tone === "error"
                    ? styles.compactVerificationError
                    : verificationStatusMessage.tone === "warning"
                      ? styles.compactVerificationWarning
                      : styles.compactVerificationNeutral),
              }}
            >
              <strong>{verificationStatusMessage.title}</strong>
              <span>{verificationStatusMessage.text}</span>
            </section>

            <form action={sendContactEmailTestAction} style={styles.testEmailForm}>
              <button
                type="submit"
                disabled={!formState.contactEmail}
                style={{
                  ...styles.testEmailButton,
                  ...(!formState.contactEmail
                    ? styles.testEmailButtonDisabled
                    : {}),
                }}
              >
                Send test email
              </button>
            </form>
          </section>

          <div style={styles.previewActions}>
            <Link
              href={`/c/${tenantSlug}?adminReturn=${encodeURIComponent(
                "/admin/settings/branding",
              )}`}
              target="_blank"
              style={styles.previewButton}
            >
              View public hub →
            </Link>

            <Link
              href={`/c/${tenantSlug}/contact`}
              target="_blank"
              style={styles.secondaryPreviewButton}
            >
              Preview contact page →
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="branding-summary-item" style={styles.summaryItem}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

const responsiveStyles = `
.branding-settings-page,
.branding-settings-page * {
  box-sizing: border-box;
}

.branding-settings-page {
  overflow-x: hidden;
}

.branding-settings-page section,
.branding-settings-page div,
.branding-settings-page form,
.branding-settings-page label,
.branding-settings-page fieldset,
.branding-settings-page aside,
.branding-settings-page a,
.branding-settings-page input,
.branding-settings-page select,
.branding-settings-page button,
.branding-settings-page span,
.branding-settings-page strong,
.branding-settings-page p,
.branding-settings-page h1,
.branding-settings-page h2,
.branding-settings-page h3 {
  min-width: 0;
  max-width: 100%;
}

.branding-settings-page input,
.branding-settings-page select,
.branding-settings-page button {
  font: inherit;
}

@media (max-width: 960px) {
  .branding-settings-page .branding-hero,
  .branding-settings-page .settings-grid {
    grid-template-columns: 1fr !important;
  }

  .branding-settings-page .preview-card {
    order: 2;
  }
}

@media (max-width: 680px) {
  .branding-settings-page {
    padding: 14px 10px 42px !important;
  }

  .branding-settings-page .branding-hero,
  .branding-settings-page .form-card,
  .branding-settings-page .preview-card {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .branding-settings-page .branding-hero {
    gap: 16px !important;
  }

  .branding-settings-page .branding-title {
    font-size: clamp(36px, 11vw, 54px) !important;
    line-height: 0.98 !important;
    letter-spacing: -0.07em !important;
  }

  .branding-settings-page .colour-grid,
  .branding-settings-page .verification-grid {
    grid-template-columns: 1fr !important;
  }

  .branding-settings-page .preview-actions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    width: 100% !important;
  }

  .branding-settings-page .preview-actions a {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }

  .branding-settings-page .branding-summary-item {
    padding: 11px !important;
  }

  .branding-settings-page a,
  .branding-settings-page p,
  .branding-settings-page h1,
  .branding-settings-page h2,
  .branding-settings-page h3,
  .branding-settings-page strong,
  .branding-settings-page span,
  .branding-settings-page input,
  .branding-settings-page select,
  .branding-settings-page button {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }
}

@media (max-width: 460px) {
  .branding-settings-page {
    padding-left: 8px !important;
    padding-right: 8px !important;
  }

  .branding-settings-page .branding-hero,
  .branding-settings-page .form-card,
  .branding-settings-page .preview-card {
    padding: 14px !important;
  }

  .branding-settings-page .primary-button,
  .branding-settings-page .upload-button,
  .branding-settings-page .test-email-button {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }

  .branding-settings-page .colour-control {
    grid-template-columns: 52px minmax(0, 1fr) !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 34%), radial-gradient(circle at top right, rgba(250,204,21,0.08), transparent 30%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 0.85fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.22), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroCopy: {
    minWidth: 0,
    maxWidth: "100%",
  },

  backLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.2,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
    minWidth: 0,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.2,
  },

  softBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#dbeafe",
    border: "1px solid rgba(191,219,254,0.26)",
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.2,
  },

  title: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  tenant: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroPanel: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  heroPanelEyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  previewLogoWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 84,
    height: 84,
    maxWidth: "100%",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.28)",
    overflow: "hidden",
  },

  previewLogo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 10,
  },

  previewLogoFallback: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroPanelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  heroPanelContact: {
    margin: 0,
    color: "#fef3c7",
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  colourPreviewRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  colourPreview: {
    display: "inline-flex",
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.75)",
  },

  successCard: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  errorCard: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  testStatusCard: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    border: "1px solid transparent",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  testStatusSuccess: {
    background: "#ecfdf5",
    color: "#047857",
    borderColor: "#a7f3d0",
  },

  testStatusWarning: {
    background: "#fffbeb",
    color: "#92400e",
    borderColor: "#fde68a",
  },

  testStatusError: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
    gap: 16,
    minWidth: 0,
  },

  formCard: {
    display: "grid",
    gap: 14,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  field: {
    display: "grid",
    gap: 8,
    minWidth: 0,
    maxWidth: "100%",
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  miniLabel: {
    display: "grid",
    gap: 7,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
    minWidth: 0,
  },

  input: {
    width: "100%",
    maxWidth: "100%",
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 13px",
    fontSize: 16,
    fontWeight: 750,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  select: {
    width: "100%",
    maxWidth: "100%",
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 13px",
    fontSize: 15,
    fontWeight: 800,
  },

  hint: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  contactPanel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,1) 72%)",
    border: "1px solid #bfdbfe",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  panelIntro: {
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  contactKicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  contactTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.08,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  contactText: {
    margin: "7px 0 0",
    color: "#1e40af",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  verificationCard: {
    display: "grid",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    border: "1px solid transparent",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  verificationSuccess: {
    background: "#ecfdf5",
    borderColor: "#a7f3d0",
  },

  verificationWarning: {
    background: "#fffbeb",
    borderColor: "#fde68a",
  },

  verificationError: {
    background: "#fef2f2",
    borderColor: "#fecaca",
  },

  verificationNeutral: {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
  },

  verificationKicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  verificationTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 19,
    lineHeight: 1.15,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  verificationText: {
    margin: "7px 0 0",
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  verificationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    minWidth: 0,
  },

  compactVerificationCard: {
    display: "grid",
    gap: 5,
    padding: 12,
    borderRadius: 16,
    border: "1px solid transparent",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    minWidth: 0,
    overflow: "hidden",
    overflowWrap: "anywhere",
  },

  compactVerificationSuccess: {
    background: "#ecfdf5",
    color: "#047857",
    borderColor: "#a7f3d0",
  },

  compactVerificationWarning: {
    background: "#fffbeb",
    color: "#92400e",
    borderColor: "#fde68a",
  },

  compactVerificationError: {
    background: "#fef2f2",
    color: "#991b1b",
    borderColor: "#fecaca",
  },

  compactVerificationNeutral: {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  },

  divider: {
    height: 1,
    background: "#e2e8f0",
    margin: "4px 0",
  },

  advancedHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    minWidth: 0,
  },

  planPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "normal",
    textAlign: "center",
    lineHeight: 1.2,
  },

  planPillIncluded: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  planPillLocked: {
    background: "#ffedd5",
    color: "#9a3412",
    border: "1px solid #fdba74",
  },

  fieldset: {
    display: "grid",
    gap: 14,
    padding: 0,
    margin: 0,
    border: "none",
    minWidth: 0,
  },

  disabledFieldset: {
    opacity: 0.55,
  },

  uploadPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },

  uploadHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    minWidth: 0,
  },

  uploadTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  uploadText: {
    margin: "4px 0 0",
    color: "#64748b",
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  uploadPreviewWrap: {
    width: 86,
    height: 62,
    borderRadius: 14,
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    flex: "0 0 auto",
  },

  uploadPreview: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 8,
  },

  uploadButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
  },

  hiddenFileInput: {
    display: "none",
  },

  colourGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    minWidth: 0,
  },

  colourField: {
    display: "grid",
    gap: 9,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },

  colourStack: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },

  colourControl: {
    display: "grid",
    gridTemplateColumns: "58px minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    minWidth: 0,
  },

  colourPicker: {
    width: 58,
    maxWidth: "100%",
    height: 50,
    padding: 4,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    cursor: "pointer",
  },

  colourValue: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 50,
    padding: "12px 13px",
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 850,
    letterSpacing: "0.03em",
    overflowWrap: "anywhere",
  },

  lockedNotice: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    lineHeight: 1.5,
    fontSize: 14,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 48,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.22)",
    textAlign: "center",
  },

  previewCard: {
    display: "grid",
    gap: 14,
    alignContent: "start",
    padding: 22,
    borderRadius: 28,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  summaryList: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },

  summaryItem: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  testEmailCard: {
    display: "grid",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.16), rgba(255,255,255,1) 74%)",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },

  testEmailKicker: {
    margin: 0,
    color: "#b45309",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  testEmailTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: 20,
    lineHeight: 1.12,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  testEmailText: {
    margin: "7px 0 0",
    color: "#78350f",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  testEmailForm: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },

  testEmailButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    justifySelf: "start",
    minHeight: 42,
    maxWidth: "100%",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    textAlign: "center",
  },

  testEmailButtonDisabled: {
    background: "#94a3b8",
    border: "1px solid #94a3b8",
    cursor: "not-allowed",
  },

  previewActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    minWidth: 0,
  },

  previewButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },

  secondaryPreviewButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    minHeight: 44,
    padding: "11px 16px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
  },
};
