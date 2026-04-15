"use client";

import Image from "next/image";
import { Camera, Loader2, MessageSquare, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ProductReviewSummary = {
  averageRating?: number | null;
  totalCount: number;
  customerCount?: number;
  externalCount?: number;
  customerAverageRating?: number | null;
  externalAverageRating?: number | null;
  withMediaCount?: number;
};

type ProductReviewEntry = {
  id: string;
  source: string;
  reviewerName: string;
  rating: number;
  title?: string | null;
  comment: string;
  mediaUrls: string[];
  verifiedPurchase: boolean;
  createdAt?: string | null;
  status?: string;
};

type ProductReviewsPanelProps = {
  productSlug: string;
  productTitle: string;
  locale: string;
  initialSummary?: ProductReviewSummary;
  initialReviews?: ProductReviewEntry[];
};

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

function formatReviewDate(value: string | null | undefined, locale: string) {
  if (!value) {
    return "Date non fournie";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date non fournie";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => index < Math.round(rating));
}

function buildNextSummary(current: ProductReviewSummary | undefined, rating: number) {
  const totalCount = Math.max(0, current?.totalCount ?? 0);
  const customerCount = Math.max(0, current?.customerCount ?? 0);
  const externalCount = Math.max(0, current?.externalCount ?? Math.max(0, totalCount - customerCount));
  const currentAverage = typeof current?.averageRating === "number" ? current.averageRating : 0;
  const nextTotalCount = totalCount + 1;
  const nextCustomerCount = customerCount + 1;
  const nextAverage = nextTotalCount > 0 ? Number((((currentAverage * totalCount) + rating) / nextTotalCount).toFixed(1)) : rating;
  const currentCustomerAverage = typeof current?.customerAverageRating === "number" ? current.customerAverageRating : 0;
  const nextCustomerAverage = nextCustomerCount > 0
    ? Number((((currentCustomerAverage * customerCount) + rating) / nextCustomerCount).toFixed(1))
    : rating;

  return {
    averageRating: nextAverage,
    totalCount: nextTotalCount,
    customerCount: nextCustomerCount,
    externalCount,
    customerAverageRating: nextCustomerAverage,
    externalAverageRating: current?.externalAverageRating,
    withMediaCount: current?.withMediaCount ?? 0,
  } satisfies ProductReviewSummary;
}

export function ProductReviewsPanel({ productSlug, productTitle, locale, initialSummary, initialReviews }: ProductReviewsPanelProps) {
  const [summary, setSummary] = useState<ProductReviewSummary | undefined>(initialSummary);
  const [reviews, setReviews] = useState<ProductReviewEntry[]>(initialReviews ?? []);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const customerReviewCount = summary?.customerCount ?? reviews.filter((entry) => entry.source === "customer").length;

  const photoPreviews = useMemo(
    () => photoFiles.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      url: URL.createObjectURL(file),
    })),
    [photoFiles],
  );

  useEffect(() => {
    return () => {
      for (const preview of photoPreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [photoPreviews]);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/account/session", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json().catch(() => null))
      .then((payload) => {
        if (cancelled) {
          return;
        }

        if (payload?.user && typeof payload.user.email === "string" && typeof payload.user.displayName === "string") {
          setSessionUser({
            id: String(payload.user.id ?? ""),
            email: payload.user.email,
            displayName: payload.user.displayName,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!sessionUser) {
      setFeedback("Connectez-vous pour laisser un avis vérifié.");
      return;
    }

    if (comment.trim().length < 8) {
      setFeedback("Votre avis doit contenir au moins 8 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      let mediaUrls: string[] = [];
      if (photoFiles.length > 0) {
        const formData = new FormData();
        for (const file of photoFiles) {
          formData.append("files[]", file);
        }

        const uploadResponse = await fetch(`/api/products/${encodeURIComponent(productSlug)}/review-media`, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const uploadPayload = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok || !Array.isArray(uploadPayload?.urls)) {
          setFeedback(typeof uploadPayload?.message === "string" ? uploadPayload.message : "Impossible d'envoyer les photos de l'avis.");
          setSubmitting(false);
          return;
        }

        mediaUrls = uploadPayload.urls.filter((entry: unknown): entry is string => typeof entry === "string" && entry.trim().length > 0);
      }

      const response = await fetch(`/api/products/${encodeURIComponent(productSlug)}/reviews`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          rating,
          title,
          comment,
          mediaUrls,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFeedback(typeof payload?.message === "string" ? payload.message : "Impossible d'enregistrer votre avis.");
        return;
      }

      const createdReview = payload?.review as ProductReviewEntry | undefined;
      if (createdReview) {
        setReviews((current) => [createdReview, ...current.filter((entry) => entry.id !== createdReview.id)]);
        setSummary((current) => ({
          ...buildNextSummary(current, createdReview.rating),
          withMediaCount: (current?.withMediaCount ?? 0) + (createdReview.mediaUrls.length > 0 ? 1 : 0),
        }));
      }
      setTitle("");
      setComment("");
      setRating(5);
      setPhotoFiles([]);
      setFeedback("Votre avis vérifié a été ajouté.");
    } catch {
      setFeedback("Impossible d'enregistrer votre avis.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => /image\/(jpeg|png|webp)/.test(file.type));
    setPhotoFiles(files.slice(0, 6));
  };

  const removePhoto = (name: string, lastModified: number) => {
    setPhotoFiles((current) => current.filter((file) => !(file.name === name && file.lastModified === lastModified)));
  };

  return (
    <article className="rounded-[8px] border border-[#eceff3] bg-white p-6 shadow-[0_10px_28px_rgba(17,24,39,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#907e70]">Avis clients</div>
          <h2 className="mt-3 text-[24px] font-bold text-[#221813] sm:text-[28px]">Tous les avis sur {productTitle}</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[8px] border border-[#efefef] bg-[#fafafa] px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94806f]">Note moyenne</div>
            <div className="mt-2 flex items-center gap-2 text-[24px] font-black text-[#221813]">
              <Star className="h-5 w-5 fill-[#f5b301] text-[#f5b301]" />
              {typeof summary?.averageRating === "number" ? summary.averageRating.toFixed(1) : "-"}
            </div>
          </div>
          <div className="rounded-[8px] border border-[#efefef] bg-[#fafafa] px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94806f]">Total consolidé</div>
            <div className="mt-2 text-[24px] font-black text-[#221813]">{summary?.totalCount ?? reviews.length}</div>
          </div>
          <div className="rounded-[8px] border border-[#efefef] bg-[#fafafa] px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#94806f]">Avis avec photos</div>
            <div className="mt-2 text-[24px] font-black text-[#221813]">{summary?.withMediaCount ?? reviews.filter((entry) => entry.mediaUrls.length > 0).length}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-[13px] font-medium text-[#5f5145]">
            <span className="rounded-full bg-[#fff5e8] px-3 py-2">Avis clients: {customerReviewCount}</span>
          </div>

          {reviews.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[#d8dde5] bg-[#fbfcfd] px-5 py-6 text-[14px] text-[#667085]">
              Aucun avis exploitable n'est encore disponible pour ce produit.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-[8px] border border-[#efefef] bg-[#fafafa] px-5 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[16px] font-bold text-[#221813]">{review.reviewerName}</div>
                        <span className={[
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                          review.source === "customer" ? "bg-[#e8f7ee] text-[#117a37]" : "bg-[#eef4ff] text-[#305b8a]",
                        ].join(" ")}>
                          {review.source === "customer" ? "Avis client vérifié" : "Avis catalogue"}
                        </span>
                        {review.verifiedPurchase ? <span className="rounded-full bg-[#fff4da] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9a6700]">Achat vérifié</span> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] text-[#6c5e52]">
                        <div className="flex items-center gap-1">
                          {renderStars(review.rating).map((filled, index) => (
                            <Star key={`${review.id}-star-${index}`} className={[
                              "h-4 w-4",
                              filled ? "fill-[#f5b301] text-[#f5b301]" : "text-[#d0d5dd]",
                            ].join(" ")} />
                          ))}
                        </div>
                        <span>{formatReviewDate(review.createdAt, locale)}</span>
                      </div>
                    </div>
                  </div>

                  {review.title ? <div className="mt-4 text-[16px] font-semibold text-[#221813]">{review.title}</div> : null}
                  <p className="mt-3 text-[14px] leading-7 text-[#4d4035]">{review.comment}</p>

                  {review.mediaUrls.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {review.mediaUrls.map((mediaUrl, index) => (
                        <div key={`${review.id}-media-${index}`} className="relative aspect-square overflow-hidden rounded-[8px] border border-[#ececec] bg-white">
                          <Image src={mediaUrl} alt={`${review.reviewerName} media ${index + 1}`} fill sizes="(max-width: 1024px) 50vw, 180px" className="object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-[8px] border border-[#eceff3] bg-[#fffaf4] p-5 shadow-[0_10px_28px_rgba(17,24,39,0.04)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#9a6c43]">
            <MessageSquare className="h-4 w-4" />
            Laisser un avis
          </div>
          <h3 className="mt-3 text-[22px] font-bold text-[#221813]">Partagez votre retour</h3>
          <p className="mt-3 text-[14px] leading-6 text-[#5f5145]">
            Votre avis est ajouté automatiquement ici après vérification de votre achat.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#4d4035]">Note</span>
              <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="h-12 w-full rounded-[8px] border border-[#e5ddd3] bg-white px-4 text-[14px] outline-none focus:border-[#f05a00]">
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} / 5</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#4d4035]">Titre</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Résumé court de votre expérience" className="h-12 w-full rounded-[8px] border border-[#e5ddd3] bg-white px-4 text-[14px] outline-none placeholder:text-[#9b8f84] focus:border-[#f05a00]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-[13px] font-semibold text-[#4d4035]">Commentaire</span>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={5} placeholder="Dites ce que vous avez reçu, ce qui vous a plu ou non." className="w-full rounded-[8px] border border-[#e5ddd3] bg-white px-4 py-3 text-[14px] leading-6 outline-none placeholder:text-[#9b8f84] focus:border-[#f05a00]" />
            </label>

            <div className="rounded-[8px] border border-dashed border-[#e2d7ca] bg-white/70 px-4 py-3 text-[13px] text-[#6c5e52]">
              <div className="flex items-center gap-2 font-semibold text-[#4d4035]">
                <Camera className="h-4 w-4" />
                Photos de votre avis
              </div>
              <div className="mt-1">Ajoutez jusqu'à 6 photos JPG, PNG ou WEBP. Elles seront publiées avec votre avis vérifié.</div>
              <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-[8px] border border-[#e5ddd3] bg-white px-4 py-2 text-[13px] font-semibold text-[#4d4035] transition hover:border-[#f05a00] hover:text-[#f05a00]">
                Choisir des photos
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhotoSelection} />
              </label>

              {photoPreviews.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photoPreviews.map((preview, index) => {
                    const sourceFile = photoFiles[index];
                    return (
                      <div key={preview.key} className="relative overflow-hidden rounded-[8px] border border-[#ececec] bg-white">
                        <div className="relative aspect-square">
                          <Image src={preview.url} alt={preview.name} fill sizes="180px" className="object-cover" unoptimized />
                        </div>
                        <button
                          type="button"
                          onClick={() => sourceFile ? removePhoto(sourceFile.name, sourceFile.lastModified) : null}
                          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                          aria-label="Retirer cette photo"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="truncate px-3 py-2 text-[11px] text-[#5f5145]">{preview.name}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {feedback ? <div className="rounded-[8px] bg-white px-4 py-3 text-[13px] font-medium text-[#8a4b16]">{feedback}</div> : null}

            <button type="submit" disabled={submitting} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#f05a00] px-5 text-[15px] font-bold text-white transition hover:bg-[#d94f00] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              Publier mon avis vérifié
            </button>

            {!sessionUser ? <div className="text-[12px] text-[#7a6a5d]">Connectez-vous avec le compte utilisé pour l’achat afin de publier un avis.</div> : null}
          </form>
        </aside>
      </div>
    </article>
  );
}