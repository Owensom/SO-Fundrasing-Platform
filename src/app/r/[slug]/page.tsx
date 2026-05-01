{raffle.config_json?.question?.text && (
  <div
    style={{
      padding: 14,
      borderRadius: 14,
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      marginBottom: 16,
    }}
  >
    <p style={{ fontWeight: 800 }}>
      To enter, answer this question:
    </p>

    <p style={{ marginBottom: 8 }}>
      {raffle.config_json.question.text}
    </p>

    <input
      id="raffle-answer"
      placeholder="Enter your answer"
      style={{
        width: "100%",
        padding: 10,
        borderRadius: 10,
        border: "1px solid #cbd5e1",
      }}
    />
  </div>
)}
