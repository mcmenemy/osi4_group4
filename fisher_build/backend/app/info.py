"""Information shift between host and implant: Gaussian-copula transfer entropy.

Transfer entropy X -> Y is how much X's recent past tells you about Y's next value
beyond what Y's own past already tells you: I(Y_t ; X_past | Y_past). We estimate it on
population firing rates with the Gaussian-copula method of Ince et al. (2017, Human
Brain Mapping): rank-transform each variable to a standard normal, then use the closed
form for Gaussian (conditional) mutual information, with the analytic bias correction.
It is numpy-only and takes milliseconds, so it can run live. This is our own
implementation of the published method (same approach as the gcmi package).

Significance: the same quantity with X circularly shifted by a random offset, which
keeps each signal's own dynamics but breaks their alignment in time.
"""

import numpy as np
from scipy.special import ndtri, psi
from scipy.stats import rankdata

BIN_MS = 5
HISTORY = 2  # bins of past used for both source and target (10 ms)
N_SURROGATES = 50
MIN_SHIFT_MS = 200


def copnorm(x: np.ndarray) -> np.ndarray:
    """Copula-normalize each column: ranks mapped to standard normal quantiles.

    Ties (common in sparse spike counts) get their average rank, so tied values stay equal.
    """
    x = np.asarray(x, dtype=float)
    if x.ndim == 1:
        x = x[:, None]
    ranks = np.apply_along_axis(rankdata, 0, x)
    return ndtri(ranks / (len(x) + 1))


def gaussian_entropy(x: np.ndarray) -> float:
    """Bias-corrected entropy (nats) of a Gaussian fitted to samples x (n_samples, n_dims)."""
    n, d = x.shape
    cov = np.atleast_2d(np.cov(x, rowvar=False))
    chol = np.linalg.cholesky(cov)
    h = np.sum(np.log(np.diag(chol))) + 0.5 * d * (np.log(2 * np.pi) + 1)
    # Expected bias of log det of a sample covariance (Wishart), removed analytically.
    psi_terms = psi((n - np.arange(1, d + 1)) / 2) / 2
    d_term = (np.log(2) - np.log(n - 1)) / 2
    return float(h - d * d_term - psi_terms.sum())


def conditional_mi(x: np.ndarray, y: np.ndarray, z: np.ndarray) -> float:
    """I(X;Y|Z) in bits for copula-normalized samples (rows = samples)."""
    h = gaussian_entropy
    nats = h(np.hstack([x, z])) + h(np.hstack([y, z])) - h(np.hstack([x, y, z])) - h(z)
    return nats / np.log(2)


def lagged(signal: np.ndarray, history: int) -> tuple[np.ndarray, np.ndarray]:
    """(present, past) where past[t] holds the `history` values before present[t]."""
    present = signal[history:]
    past = np.column_stack([signal[history - k : len(signal) - k] for k in range(1, history + 1)])
    return present, past


def transfer_entropy(source: np.ndarray, target: np.ndarray, history: int = HISTORY) -> float:
    """TE source -> target in bits."""
    y_now, y_past = lagged(target, history)
    _, x_past = lagged(source, history)
    return conditional_mi(copnorm(y_now), copnorm(x_past), copnorm(y_past))


def te_with_null(
    source: np.ndarray, target: np.ndarray, rng: np.random.Generator, n_surrogates: int = N_SURROGATES
) -> dict:
    """TE plus a circular-shift null. Returns None-valued fields if a signal is constant."""
    if np.ptp(source) == 0 or np.ptp(target) == 0:
        return {"bits": None, "null_95": None, "significant": False}
    try:
        te = transfer_entropy(source, target)
    except np.linalg.LinAlgError:  # degenerate covariance, e.g. an almost silent signal
        return {"bits": None, "null_95": None, "significant": False}
    min_shift = MIN_SHIFT_MS // BIN_MS
    max_shift = len(source) - min_shift
    if max_shift <= min_shift:
        return {"bits": round(te, 4), "null_95": None, "significant": False}
    shifts = rng.integers(min_shift, max_shift, n_surrogates)
    null = []
    for shift in shifts:
        try:
            null.append(transfer_entropy(np.roll(source, shift), target))
        except np.linalg.LinAlgError:
            continue
    if not null:
        return {"bits": round(te, 4), "null_95": None, "significant": False}
    null_95 = float(np.quantile(null, 0.95))
    return {"bits": round(te, 4), "null_95": round(null_95, 4), "significant": bool(te > null_95)}


def population_counts(t_ms: np.ndarray, i: np.ndarray, members: np.ndarray, duration_ms: float) -> np.ndarray:
    """Spike count per BIN_MS bin, summed over the given neurons."""
    n_bins = int(duration_ms // BIN_MS)
    sel = np.isin(i, members)
    counts, _ = np.histogram(t_ms[sel], bins=n_bins, range=(0, n_bins * BIN_MS))
    return counts.astype(float)


def host_implant_te(t_ms, i, layout, implant_names, duration_ms, seed: int) -> dict:
    """TE host -> implant and implant -> host on population spike counts."""
    host = population_counts(t_ms, i, layout.indices("host"), duration_ms)
    implant_idx = np.concatenate([layout.indices(n) for n in implant_names])
    implant = population_counts(t_ms, i, implant_idx, duration_ms)
    rng = np.random.default_rng(seed)
    return {
        "host_to_implant": te_with_null(host, implant, rng),
        "implant_to_host": te_with_null(implant, host, rng),
        "bin_ms": BIN_MS,
        "history_bins": HISTORY,
    }
