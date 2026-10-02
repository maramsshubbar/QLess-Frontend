import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  EnvelopeSimple,
  MapPin,
  Megaphone,
  Phone,
  Star,
} from "@phosphor-icons/react";
import {
  getBusiness,
  getBusinessAnnouncements,
  getBusinessBranches,
  getBusinessReviews,
} from "../../services/businessService";
import "../Details/Details.css";

export default function BusinessDetailsPage() {
  const { businessId } = useParams();
  const [page, setPage] = useState({ status: "loading", error: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setPage({ status: "loading", error: "" });

    Promise.all([
      getBusiness(businessId, { signal }),
      getBusinessBranches(businessId, { signal }),
      // these two are extras: if they fail, the page still shows
      getBusinessAnnouncements(businessId, { signal }).catch(() => []),
      getBusinessReviews(businessId, { signal }).catch(() => null),
    ])
      .then(([business, branches, announcements, reviews]) => {
        setPage({ status: "ready", business, branches, announcements, reviews });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setPage({
          status: err.status === 404 ? "notfound" : "error",
          error: err.message,
        });
      });

    return () => controller.abort();
  }, [businessId, reloadKey]);

  /* ---------- loading ---------- */
  if (page.status === "loading") {
    return (
      <main className="dt" aria-busy="true">
        <div className="dt__container">
          <div className="dt-skeleton dt-skeleton--title" />
          <div className="dt-skeleton dt-skeleton--line" />
          <div className="dt-skeleton dt-skeleton--block" />
        </div>
      </main>
    );
  }

  /* ---------- not found ---------- */
  if (page.status === "notfound") {
    return (
      <main className="dt">
        <div className="dt__container">
          <div className="dt__message">
            <h1>This place isn't available</h1>
            <p>It may have been removed, or it isn't approved yet.</p>
            <Link className="btn btn--primary" to="/businesses">
              Browse places
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- error ---------- */
  if (page.status === "error") {
    return (
      <main className="dt">
        <div className="dt__container">
          <div className="dt__message" role="alert">
            <h1>We couldn't load this place</h1>
            <p>{page.error}. Check your connection and try again.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ---------- ready ---------- */
  const { business, branches, announcements, reviews } = page;
  const hasRating = reviews && reviews.review_count > 0;

  return (
    <main className="dt">
      <div className="dt__container">
        <Link className="dt__back" to="/businesses">
          <ArrowLeft size={16} weight="bold" />
          All places
        </Link>

        {/* Header */}
        <header className="dt__header">
          <span className="dt__logo">
            {business.image ? <img src={business.image} alt="" /> : business.name.charAt(0)}
          </span>

          <div className="dt__header-body">
            {business.category && (
              <div className="dt__row">
                <span className="dt__tag">{business.category.name}</span>
              </div>
            )}

            <h1 className="dt__title">{business.name}</h1>

            {business.description && <p className="dt__desc">{business.description}</p>}

            <ul className="dt__meta">
              {hasRating && (
                <li className="dt__rating">
                  <Star size={16} weight="fill" />
                  <b>{reviews.average_rating?.toFixed(1)}</b>
                  {reviews.review_count} {reviews.review_count === 1 ? "review" : "reviews"}
                </li>
              )}
              {business.phone && (
                <li>
                  <Phone size={16} />
                  <a href={`tel:${business.phone}`}>{business.phone}</a>
                </li>
              )}
              {business.email && (
                <li>
                  <EnvelopeSimple size={16} />
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </li>
              )}
            </ul>
          </div>
        </header>

        {/* Announcements */}
        {announcements.length > 0 && (
          <ul className="dt__notices" aria-label="Announcements">
            {announcements.map((notice) => (
              <li key={notice.id} className="dt__notice">
                <span className="dt__notice-icon">
                  <Megaphone size={20} weight="duotone" />
                </span>
                <div>
                  <strong>{notice.title}</strong>
                  <p>{notice.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Branches */}
        <section className="dt__section" aria-labelledby="branches-title">
          <div className="dt__section-head">
            <h2 id="branches-title">Choose a branch</h2>
            <span>
              {branches.length} {branches.length === 1 ? "branch" : "branches"}
            </span>
          </div>

          {branches.length === 0 ? (
            <p className="dt__empty">This business hasn't added any branches yet.</p>
          ) : (
            <div className="dt__grid">
              {branches.map((branch) => (
                <Link key={branch.id} to={`/branches/${branch.id}`} className="dt-branch">
                  <div className="dt__row">
                    <span
                      className={`dt__status ${branch.is_open_now ? "dt__status--open" : "dt__status--closed"
                        }`}
                    >
                      {branch.is_open_now ? "Open now" : "Closed"}
                    </span>
                  </div>
                  <h3>{branch.name}</h3>
                  {branch.address && (
                    <p>
                      <MapPin size={16} />
                      {branch.address}
                    </p>
                  )}
                  <span className="dt-branch__more">
                    View queues <ArrowRight size={16} weight="bold" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}