function renderContactLogo() {
  const logoUrl = getAssetUrl(CONTACT_EMAIL_LOGO_PATH);

  return `
    <div style="
      text-align:center;
      padding:26px 22px 16px;
      background:linear-gradient(135deg,#020617 0%,#0f172a 58%,#172554 100%);
    ">
      <img
        src="${escapeHtml(logoUrl)}"
        alt="SO Fundraising Platform contact"
        width="190"
        style="
          display:inline-block;
          width:190px;
          max-width:72%;
          height:auto;
          border:0;
          outline:none;
          text-decoration:none;
        "
      />
    </div>
  `;
}
