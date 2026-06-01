        <div style={styles.previewShell}>
          <div style={styles.previewBadge}>Public preview</div>

          <div style={styles.previewImageWrap}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Squares preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                  display: "block",
                }}
              />
            ) : (
              <img
                src={DEFAULT_SQUARES_IMAGE}
                alt="Squares placeholder"
                style={styles.placeholderImage}
              />
            )}
          </div>

          <div style={styles.previewCardBody}>
            <div style={styles.previewTitle}>
              {title.trim() ? title : "Your squares game"}
            </div>

            <div style={styles.previewText}>
              {description.trim()
                ? description.trim().slice(0, 92)
                : "A short public summary of your squares game will appear here."}
              {description.trim().length > 92 ? "…" : ""}
            </div>

            <div style={styles.previewMetaGrid}>
              <span style={styles.previewMetaItem}>
                {formatPreviewMoney(price, currency)} each
              </span>

              <span style={styles.previewMetaItem}>{boardSize} squares</span>

              <span style={styles.previewMetaItem}>
                {formatDatePreview(drawAtValue)}
              </span>

              <span style={styles.previewMetaItem}>
                {prizeText(publicPrizesCount)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="Estimated revenue"
          value={formatPreviewMoney(estimatedTotal, currency)}
        />

        <SummaryCard label="Board size" value={`${boardSize} squares`} />

        <SummaryCard
          label="Draw status"
          value={drawAtValue ? "Scheduled" : "Not scheduled"}
        />

        <SummaryCard
          label="Legal readiness"
          value={hasLegalQuestion || hasFreeEntry ? "In progress" : "Not set"}
        />

        <SummaryCard label="Public prizes" value={prizeText(publicPrizesCount)} />
      </section>

      <section style={styles.readinessGrid}>
        <ReadinessCard eyebrow="Campaign readiness" title="Before publishing">
          <CheckItem done={Boolean(title.trim())}>Add campaign title</CheckItem>
          <CheckItem done={Boolean(slug.trim())}>Confirm public slug</CheckItem>
          <CheckItem done={Boolean(description.trim())}>Add description</CheckItem>
          <CheckItem done={boardSize > 0}>Set board size</CheckItem>
          <CheckItem done={price > 0}>Set price per square</CheckItem>
          <CheckItem done={publicPrizesCount > 0}>Add public prize</CheckItem>
        </ReadinessCard>

        <ReadinessCard
          eyebrow="Sales preview"
          title={formatPreviewMoney(estimatedTotal, currency)}
        >
          <PreviewLine label="Board" value={`${boardSize} squares`} />
          <PreviewLine
            label="Price"
            value={`${formatPreviewMoney(price, currency)} each`}
          />
          <PreviewLine
            label="Layout"
            value={`${boardShape.columns} × ${boardShape.rows}`}
          />
        </ReadinessCard>

        <ReadinessCard eyebrow="Compliance preview" title="Legal checks">
          <CheckItem done={hasLegalQuestion}>Skill question configured</CheckItem>
          <CheckItem done={hasFreeEntry}>Free postal entry configured</CheckItem>
          <CheckItem done={Boolean(drawAtValue)}>Draw date scheduled</CheckItem>
        </ReadinessCard>
      </section>

      <SectionCard
        number="01"
        title="Campaign details"
        description="Set the public title, URL, description and draw date."
        badge={drawAtValue ? "Draw scheduled" : undefined}
        tone="default"
      >
        <div style={styles.twoColumn}>
          <Field label="Squares game title">
            <input
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              style={styles.input}
              placeholder="Summer fundraiser squares"
            />
          </Field>

          <Field label="Public URL slug">
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
              style={styles.input}
              placeholder="summer-fundraiser-squares"
            />
          </Field>
        </div>

        <Field label="Public description">
          <textarea
            name="description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            style={styles.textarea}
            placeholder="Describe the game, prizes, event details and draw information."
          />
        </Field>

        <div style={styles.twoColumn}>
          <Field label="Draw date">
            <input
              type="text"
              inputMode="numeric"
              value={drawDate}
              onChange={(event) => setDrawDate(cleanDatePart(event.target.value))}
              style={styles.input}
              placeholder="YYYY-MM-DD"
            />
          </Field>

          <Field label="Draw time">
            <input
              type="text"
              inputMode="numeric"
              value={drawTime}
              onChange={(event) => setDrawTime(cleanTimePart(event.target.value))}
              style={styles.input}
              placeholder="HH:MM"
            />
          </Field>
        </div>

        <div style={styles.drawPreviewField}>
          <div style={styles.drawPreviewInline}>
            <span style={styles.previewInfoLabel}>Draw preview</span>

            <span style={styles.previewInfoValue}>
              {formatDatePreview(drawAtValue)}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        number="02"
        title="Squares setup"
        description="Configure board size, square pricing, currency and publication status."
        badge={`${boardSize} squares • ${formatPreviewMoney(
          price,
          currency,
        )} each`}
        tone="setup"
      >
        <div style={styles.fourColumn}>
          <Field label="Number of squares">
            <input
              name="total_squares"
              type="number"
              min={1}
              max={500}
              required
              value={totalSquares}
              onChange={(event) => setTotalSquares(event.target.value)}
              style={styles.input}
            />
          </Field>

          <Field label="Price per square">
            <input
              name="price_per_square"
              type="number"
              min={0}
              step="0.01"
              required
              value={pricePerSquare}
              onChange={(event) => setPricePerSquare(event.target.value)}
              style={styles.input}
            />
          </Field>

          <Field label="Currency">
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              style={styles.input}
            >
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>

          <Field label="Status">
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={styles.input}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>

        <div style={styles.boardPreviewCard}>
          <div style={styles.boardPreviewTop}>
            <div>
              <div style={styles.boardPreviewLabel}>Board preview</div>

              <div style={styles.boardPreviewTitle}>
                {boardShape.columns} × {boardShape.rows}
              </div>
            </div>

            <div style={styles.boardPreviewBadge}>{boardSize} squares</div>
          </div>

          <div
            style={{
              ...styles.boardGrid,
              gridTemplateColumns: `repeat(${Math.min(
                boardShape.columns,
                10,
              )}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: Math.min(boardSize, 50) }).map((_, index) => (
              <div key={index} style={styles.boardCell}>
                {index + 1}
              </div>
            ))}
          </div>

          <p style={styles.boardFootnote}>
            Showing first {Math.min(boardSize, 50)} squares as a preview. The
            public board will use the full {boardSize} squares.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        number="03"
        title="Squares image"
        description="Upload a strong public image and choose the crop focus."
        badge={imageUrl ? "Image selected" : "Using default image"}
        tone="media"
      >
        <div style={styles.mediaBox}>
          <div style={styles.mediaControls}>
            <h3 style={styles.subTitle}>Squares image</h3>

            <ImageFocusUploadField
              currentImageUrl={imageUrl}
              currentFocusX={imageFocusX}
              currentFocusY={imageFocusY}
              label="Squares image"
              previewAlt={title.trim() || "Squares preview"}
              subscriptionTier={subscriptionTier}
              customImagesAllowed={customImagesAllowed}
              onImageUrlChange={setImageUrl}
              onFocusXChange={setImageFocusX}
              onFocusYChange={setImageFocusY}
            />
          </div>

          <div style={styles.previewBoxLarge}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Squares preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                  display: "block",
                }}
              />
            ) : (
              <img
                src={DEFAULT_SQUARES_IMAGE}
                alt="Squares placeholder"
                style={styles.previewPlaceholderImage}
              />
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        number="04"
        title="Prize settings"
        description="Add prizes and choose which ones appear publicly on the campaign page."
        badge={prizeText(publicPrizesCount)}
        tone="prize"
      >
        <div style={styles.prizeSectionShell}>
          <div style={styles.prizeSectionTop}>
            <div>
              <div style={styles.prizeSectionTitle}>Public prize list</div>

              <div style={styles.prizeSectionText}>
                These prizes can also be used later during winner draws.
              </div>
            </div>

            <button
              type="button"
              onClick={addPrize}
              style={styles.prizeAddButton}
            >
              + Add prize
            </button>
          </div>

          <div style={styles.prizeList}>
            {prizes.map((prize, index) => (
              <div key={prize.id} style={styles.prizeRow}>
                <div style={styles.rowHeader}>
                  <strong>Prize {index + 1}</strong>

                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={prize.is_public}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          is_public: event.target.checked,
                        })
                      }
                    />
                    Show publicly
                  </label>
                </div>

                <div style={styles.prizeGrid}>
                  <Field label="Position">
                    <input
                      value={prize.position}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          position: event.target.value,
                        })
                      }
                      type="number"
                      min="1"
                      step="1"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Prize title">
                    <input
                      value={prize.title}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          title: event.target.value,
                        })
                      }
                      placeholder="1st Prize"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Description optional">
                  <textarea
                    value={prize.description}
                    onChange={(event) =>
                      updatePrize(prize.id, {
                        description: event.target.value,
                      })
                    }
                    rows={2}
                    style={styles.textarea}
                  />
                </Field>

                <button
                  type="button"
                  onClick={() => removePrize(prize.id)}
                  disabled={prizes.length <= 1}
                  style={{
                    ...styles.removePrizeButton,
                    cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                    opacity: prizes.length <= 1 ? 0.55 : 1,
                  }}
                >
                  Remove prize
                </button>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    alignItems: "stretch",
    padding: "clamp(20px, 4vw, 26px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
  },
  heroContent: { minWidth: 0 },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12,
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 5vw, 48px)",
    lineHeight: 1.02,
    letterSpacing: "-0.06em",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    maxWidth: 680,
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
  },
  heroSlug: {
    margin: "10px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 800,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "14px 0 0",
    color: "#dbeafe",
    lineHeight: 1.65,
    maxWidth: 720,
    overflowWrap: "anywhere",
    fontSize: 16,
  },
  heroUseCase: {
    margin: "12px 0 0",
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#bfdbfe",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
  },
  heroMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 22,
  },
  heroMetric: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  heroMetricLabel: { color: "#bfdbfe", fontSize: 12, fontWeight: 900 },
  heroMetricValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  previewShell: {
    display: "grid",
    alignContent: "start",
    gap: 12,
    borderRadius: 24,
    padding: 14,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  previewBadge: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  previewImageWrap: {
    height: 240,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderImage: {
    width: "min(82%, 218px)",
    height: "min(82%, 218px)",
    objectFit: "contain",
    display: "block",
  },
  previewCardBody: {
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
  },
  previewTitle: { fontSize: 18, fontWeight: 950, letterSpacing: "-0.03em" },
  previewText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  },
  previewMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },
  previewMetaItem: {
    padding: "8px 10px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: { color: "#64748b", fontSize: 12, fontWeight: 900 },
  summaryValue: {
    color: "#0f172a",
    fontSize: 21,
    fontWeight: 950,
    marginTop: 5,
    wordBreak: "break-word",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
  },
  readinessCard: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  readinessEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  readinessTitle: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
  },
  readinessBody: { display: "grid", gap: 10, marginTop: 14 },
  previewLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    color: "#334155",
    fontSize: 14,
  },
  previewLineLabel: { color: "#64748b", fontWeight: 800 },
  previewLineValue: { color: "#0f172a", fontWeight: 950, textAlign: "right" },
  sectionCard: {
    padding: "clamp(18px, 4vw, 22px)",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },
  sectionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
  },
  sectionSummaryText: { minWidth: 0 },
  sectionActions: {
    display: "flex",
    gap: 7,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  sectionNumber: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.03em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  sectionBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #dbe3ef",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  openButton: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  sectionBody: { display: "grid", gap: 14, marginTop: 14 },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 14,
  },
  drawPreviewField: { display: "grid", alignContent: "end", minWidth: 0 },
  drawPreviewInline: {
    width: "100%",
    minHeight: 48,
    display: "grid",
    alignContent: "center",
    padding: "8px 13px",
    borderRadius: 14,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    boxSizing: "border-box",
  },
  previewInfoLabel: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    marginBottom: 2,
  },
  previewInfoValue: {
    color: "#1e3a8a",
    fontSize: 15,
    lineHeight: 1.25,
    fontWeight: 950,
  },
  fourColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 14,
  },
  field: { display: "grid", gap: 7, minWidth: 0 },
  label: { color: "#334155", fontSize: 13, fontWeight: 900 },
  input: {
    width: "100%",
    minHeight: 48,
    padding: "12px 13px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "12px 13px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  boardPreviewCard: {
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #dbeafe",
  },
  boardPreviewTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  boardPreviewLabel: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  boardPreviewTitle: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  boardPreviewBadge: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 950,
  },
  boardGrid: { display: "grid", gap: 7 },
  boardCell: {
    aspectRatio: "1 / 1",
    minHeight: 34,
    borderRadius: 11,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    color: "#1e3a8a",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 14px rgba(15,23,42,0.04)",
  },
  boardFootnote: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    margin: "12px 0 0",
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 16,
    padding: 14,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: { minWidth: 0 },
  subTitle: {
    margin: "0 0 10px",
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  previewBoxLarge: {
    height: 230,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholderImage: {
    width: "min(82%, 205px)",
    height: "min(82%, 205px)",
    objectFit: "contain",
    display: "block",
  },
  prizeSectionShell: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },
  prizeSectionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  prizeSectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  prizeSectionText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  prizeAddButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #facc15",
    background: "#fef3c7",
    color: "#92400e",
    cursor: "pointer",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  prizeList: { display: "grid", gap: 12 },
  prizeRow: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #fde68a",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 55%, #f8fafc 100%)",
    minWidth: 0,
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(96px, 120px) minmax(0, 1fr)",
    gap: 12,
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    fontWeight: 900,
    color: "#334155",
    cursor: "pointer",
  },
  removePrizeButton: {
    width: "fit-content",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
  },
  legalBody: { display: "grid", gap: 14 },
  complianceRow: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  checkItem: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    color: "#334155",
    fontSize: 14,
    fontWeight: 800,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
    flexShrink: 0,
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    overflowWrap: "anywhere",
  },
  mutedSmall: { color: "#64748b", fontSize: 13, marginTop: 3 },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    marginTop: 18,
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  submitText: { minWidth: 0, flex: "1 1 240px" },
  submitEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },
  submitTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  submitButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
};
        
