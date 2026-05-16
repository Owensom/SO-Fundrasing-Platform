"use client";

import { useMemo, useState } from "react";

type TierKey = "community" | "professional" | "foundation";

type Props = {
  initialTier: TierKey;
  initialPlatformFeePercent: number;
};

const TIER_DEFAULTS: Record<
  TierKey,
  {
    fee: number;
    capabilities: {
      crm: boolean;
      auctions: boolean;
      reservedSeating: boolean;
      financeDashboard: boolean;
      whiteLabel: boolean;
      customDomain: boolean;
    };
  }
> = {
  community: {
    fee: 7,
    capabilities: {
      crm: false,
      auctions: false,
      reservedSeating: false,
      financeDashboard: false,
      whiteLabel: false,
      customDomain: false,
    },
  },

  professional: {
    fee: 3.5,
    capabilities: {
      crm: true,
      auctions: true,
      reservedSeating: true,
      financeDashboard: true,
      whiteLabel: false,
      customDomain: false,
    },
  },

  foundation: {
    fee: 1.5,
    capabilities: {
      crm: true,
      auctions: true,
      reservedSeating: true,
      financeDashboard: true,
      whiteLabel: true,
      customDomain: true,
    },
  },
};

const cardStyle = {
  border: "1px solid #dbe3f0",
  borderRadius: 18,
  padding: 18,
  background: "#ffffff",
};

const enabledStyle = {
  color: "#166534",
  fontWeight: 700,
};

const disabledStyle = {
  color: "#64748b",
  fontWeight: 700,
};

export default function BillingSettingsForm({
  initialTier,
  initialPlatformFeePercent,
}: Props) {
  const [tier, setTier] = useState<TierKey>(initialTier);

  const [platformFeePercent, setPlatformFeePercent] = useState<number>(
    initialPlatformFeePercent,
  );

  const tierCapabilities = useMemo(() => {
    return TIER_DEFAULTS[tier].capabilities;
  }, [tier]);

  function handleTierChange(nextTier: TierKey) {
    setTier(nextTier);
    setPlatformFeePercent(TIER_DEFAULTS[nextTier].fee);
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <label
          style={{
            display: "grid",
            gap: 8,
          }}
        >
          <span
            style={{
              fontWeight: 700,
            }}
          >
            Subscription tier
          </span>

          <select
            value={tier}
            onChange={(event) =>
              handleTierChange(event.target.value as TierKey)
            }
            name="subscription_tier"
            style={{
              minHeight: 48,
              borderRadius: 14,
              border: "1px solid #cbd5e1",
              padding: "0 14px",
              fontSize: 16,
            }}
          >
            <option value="community">
              Community — Free + 7%
            </option>

            <option value="professional">
              Professional — £25/month + 3.5%
            </option>

            <option value="foundation">
              Foundation — £99/month + 1.5%
            </option>
          </select>
        </label>

        <label
          style={{
            display: "grid",
            gap: 8,
          }}
        >
          <span
            style={{
              fontWeight: 700,
            }}
          >
            Platform fee percentage
          </span>

          <input
            type="number"
            value={platformFeePercent}
            onChange={(event) =>
              setPlatformFeePercent(Number(event.target.value))
            }
            name="platform_fee_percent"
            min={0}
            max={100}
            step={0.1}
            style={{
              minHeight: 48,
              borderRadius: 14,
              border: "1px solid #cbd5e1",
              padding: "0 14px",
              fontSize: 16,
            }}
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            CRM
          </div>

          <div
            style={
              tierCapabilities.crm
                ? enabledStyle
                : disabledStyle
            }
          >
            {tierCapabilities.crm ? "Enabled" : "Not included"}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Auctions
          </div>

          <div
            style={
              tierCapabilities.auctions
                ? enabledStyle
                : disabledStyle
            }
          >
            {tierCapabilities.auctions
              ? "Enabled"
              : "Not included"}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Reserved seating
          </div>

          <div
            style={
              tierCapabilities.reservedSeating
                ? enabledStyle
                : disabledStyle
            }
          >
            {tierCapabilities.reservedSeating
              ? "Enabled"
              : "Not included"}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Finance dashboard
          </div>

          <div
            style={
              tierCapabilities.financeDashboard
                ? enabledStyle
                : disabledStyle
            }
          >
            {tierCapabilities.financeDashboard
              ? "Enabled"
              : "Not included"}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            White label
          </div>

          <div
            style={
              tierCapabilities.whiteLabel
                ? enabledStyle
                : disabledStyle
            }
          >
            {tierCapabilities.whiteLabel
              ? "Enabled"
              : "Not included"}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Custom domain
          </div>

          <div
            style={
              tierCapabilities.customDomain
                ? enabledStyle
                : disabledStyle
            }
          >
            {tierCapabilities.customDomain
              ? "Enabled"
              : "Not included"}
          </div>
        </div>
      </div>
    </div>
  );
}
