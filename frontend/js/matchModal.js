// ================= INSTANT MATCH MODAL COMPONENT =================

function showInstantMatchModal(matches, targetItem) {
    if (!matches || matches.length === 0) return;

    let modalEl = document.getElementById("instantMatchModal");
    if (!modalEl) {
        modalEl = document.createElement("div");
        modalEl.id = "instantMatchModal";
        modalEl.className = "modal fade";
        modalEl.tabIndex = -1;
        document.body.appendChild(modalEl);
    }

    const targetType = targetItem ? targetItem.status : 'item';
    const topMatch = matches[0];

    let cardsHtml = matches.map(m => {
        const img = window.helpers ? window.helpers.getItemImage(m) : (m.image || 'assets/images/no-image.png');
        const badgeColor = m.matchPercentage >= 80 ? 'bg-success' : 'bg-warning text-dark';
        
        return `
            <div class="col-md-6 mb-3">
                <div class="card h-100 border-info shadow-sm bg-dark text-light">
                    <div class="position-relative">
                        <img src="${img}" class="card-img-top" style="height:140px; object-fit:cover;" alt="${m.itemName}">
                        <span class="badge ${badgeColor} position-absolute top-0 end-0 m-2 px-2 py-1 fs-6 fw-bold">
                            🤖 ${m.matchPercentage}% MATCH
                        </span>
                    </div>
                    <div class="card-body">
                        <h6 class="fw-bold text-info">${m.itemName}</h6>
                        <p class="small text-muted mb-1"><i class="bi bi-tag me-1"></i> ${m.category || '-'} | ${m.brand || '-'}</p>
                        <p class="small text-muted mb-2"><i class="bi bi-geo-alt-fill text-danger me-1"></i> ${m.location || '-'}</p>
                        <a href="item-details.html?id=${m.id}" class="btn btn-sm btn-outline-info w-100 fw-bold">
                            <i class="bi bi-eye-fill me-1"></i> View & Claim Match
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    modalEl.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content bg-dark text-light border-cyan shadow-lg" style="border: 2px solid #00f0ff;">
                <div class="modal-header border-bottom border-secondary bg-black">
                    <h5 class="modal-title fw-bold text-cyan">
                        <i class="bi bi-cpu-fill text-cyan me-2"></i> 🤖 AI Match Found (${matches.length})
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-4">
                    <div class="alert alert-dark border-info text-cyan mb-4 d-flex align-items-center">
                        <i class="bi bi-magic fs-3 me-3 text-info"></i>
                        <div>
                            <strong>Highest Confidence Match: ${topMatch.matchPercentage}%</strong><br>
                            We found an item matching your reported ${targetType}! Check the details below to claim or contact.
                        </div>
                    </div>
                    <div class="row">
                        ${cardsHtml}
                    </div>
                </div>
                <div class="modal-footer border-top border-secondary bg-black">
                    <button type="button" class="btn btn-secondary px-4" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

window.showInstantMatchModal = showInstantMatchModal;
