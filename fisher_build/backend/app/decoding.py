"""Linear decoder for the neuron-loss simulation: how well can the stimulus class be read
out of the surviving neurons' spike counts?

A ridge-regularized linear classifier (one-vs-rest least squares), scored with
stratified cross-validation so it is always tested on trials it wasn't trained on.
The ridge strength is picked by an inner cross-validation on the training trials only.
"""

import numpy as np

LAMBDAS = (0.1, 1.0, 10.0, 100.0, 1000.0)


def stratified_folds(y: np.ndarray, n_folds: int) -> np.ndarray:
    """Fold number per trial, with each class spread evenly across folds."""
    folds = np.empty(len(y), dtype=int)
    for label in np.unique(y):
        idx = np.flatnonzero(y == label)
        folds[idx] = np.arange(len(idx)) % n_folds
    return folds


def _fit_predict(x_train, y_train, x_test, n_classes, lam):
    mean = x_train.mean(axis=0)
    std = x_train.std(axis=0)
    keep = std > 0  # neurons that never varied in training carry no information
    if not keep.any():
        # Nothing to decode from: guess the most common training class.
        return np.full(len(x_test), np.bincount(y_train, minlength=n_classes).argmax())
    xtr = (x_train[:, keep] - mean[keep]) / std[keep]
    xte = (x_test[:, keep] - mean[keep]) / std[keep]
    targets = np.eye(n_classes)[y_train]
    targets -= targets.mean(axis=0)
    # Dual form: (X X^T + lam I)^-1 is trials x trials, small even with many neurons.
    gram = xtr @ xtr.T
    alpha = np.linalg.solve(gram + lam * np.eye(len(xtr)), targets)
    scores = xte @ (xtr.T @ alpha)
    return scores.argmax(axis=1)


def _choose_lambda(x, y, n_classes, n_folds):
    folds = stratified_folds(y, n_folds)
    best, best_acc = LAMBDAS[0], -1.0
    for lam in LAMBDAS:
        correct = 0
        for f in range(n_folds):
            test = folds == f
            pred = _fit_predict(x[~test], y[~test], x[test], n_classes, lam)
            correct += int((pred == y[test]).sum())
        if correct > best_acc:
            best, best_acc = lam, correct
    return best


def cv_accuracy(x: np.ndarray, y: np.ndarray, n_classes: int, n_folds: int = 5) -> float:
    """Cross-validated decoding accuracy (0-1). With no neurons left, returns chance."""
    if x.shape[1] == 0:
        return 1 / n_classes
    folds = stratified_folds(y, n_folds)
    correct = 0
    for f in range(n_folds):
        test = folds == f
        lam = _choose_lambda(x[~test], y[~test], n_classes, n_folds=3)
        pred = _fit_predict(x[~test], y[~test], x[test], n_classes, lam)
        correct += int((pred == y[test]).sum())
    return correct / len(y)
