const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const text = (id, value) => { document.getElementById(id).textContent = value; };

fetch("/api/v1/control-room", { headers: { Accept: "application/json" } })
  .then((response) => { if (!response.ok) throw new Error(`API ${response.status}`); return response.json(); })
  .then((data) => {
    text("mode", data.workspace.mode.replace("_", " "));
    text("available", `$${usd.format(data.wallet.availableUsd)}`);
    text("settled", `$${usd.format(data.wallet.settledUsd)}`);
    text("reserved", `$${usd.format(data.wallet.reservedUsd)}`);
    text("limit", `$${usd.format(data.authority.maximumDecisionUsd)}`);
    text("policy", `v${data.authority.version}`);
    text("hypothesis", data.activeDecision.hypothesis);
    text("evidence", `${data.activeDecision.evidenceCount} EVIDENCE`);
    text("tranche", `$${usd.format(data.activeDecision.requestedUsd)}`);
    text("distribution", data.activeDecision.distributionState);
    text("approval-count", String(data.approvals.length));
    text("generated", `Frozen ${new Date(data.generatedAt).toLocaleString("en-US", { dateStyle:"medium", timeStyle:"short" })}`);
    const approval = data.approvals[0];
    document.getElementById("approval").innerHTML = approval
      ? `<small>${approval.kind} GATE</small><b>Production execution held</b><p>${approval.reason.replaceAll("_", " ").toLowerCase()}</p><span class="amount">$${usd.format(approval.amountUsd)}</span>`
      : "<p>No decisions require attention.</p>";
    document.getElementById("portfolio").innerHTML = data.portfolio.map((item, index) =>
      `<article class="portfolio-card ${item.status === "ACTIVE" ? "active" : ""}"><span class="index">0${index + 1}</span><h3>${item.name}</h3><p>${item.stage} / ${item.status}</p></article>`
    ).join("");
  })
  .catch((error) => { document.querySelector("main").innerHTML = `<p class="error">Control Room unavailable: ${error.message}</p>`; });
