import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, MagnifyingGlass, Storefront, X } from "@phosphor-icons/react";
import { getBusinesses } from "../../services/businessService";
import { getCategories } from "../../services/categoryService";
import "./BrowsePage.css";

// Waits until the user stops typing before searching
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("search") || "");
  const debouncedQuery = useDebounce(query);

  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState({ status: "loading", items: [], error: "" });
  const [reloadKey, setReloadKey] = useState(0);

  const search = params.get("search") || "";
  const categoryId = params.get("category_id") || "";

  // Load categories once.
  // Links from the landing page use ?category=Banks, so turn the name into an id.
  useEffect(() => {
    const controller = new AbortController();

    getCategories({ signal: controller.signal })
      .then((list) => {
        setCategories(list);

        const name = params.get("category");
        if (name) {
          const match = list.find(
            (c) => c.name?.toLowerCase() === name.toLowerCase()
          );
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete("category");
              if (match) next.set("category_id", match.id);
              return next;
            },
            { replace: true }
          );
        }
      })
      .catch(() => {
        // Categories are optional; the page still works without chips
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the search text in the URL, so results can be shared or refreshed
  useEffect(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const value = debouncedQuery.trim();
        if (value) next.set("search", value);
        else next.delete("search");
        return next;
      },
      { replace: true }
    );
  }, [debouncedQuery, setParams]);

  // Load businesses whenever the search or category changes
  useEffect(() => {
    const controller = new AbortController();
    setResults((prev) => ({ ...prev, status: "loading", error: "" }));

    getBusinesses({ search, categoryId, signal: controller.signal })
      .then((items) => setResults({ status: "ready", items, error: "" }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setResults({ status: "error", items: [], error: err.message });
      });

    return () => controller.abort();
  }, [search, categoryId, reloadKey]);

  const selectCategory = (id) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("category_id", id);
      else next.delete("category_id");
      return next;
    });
  };

  const clearFilters = () => {
    setQuery("");
    setParams({});
  };

  const categoryName = (business) =>
    business.category?.name ||
    business.category_name ||
    categories.find((c) => String(c.id) === String(business.category_id))?.name ||
    "";

  const count = results.items.length;

  return (
    <main className="browse">
      {/* ---------- Header: title, search, categories ---------- */}
      <section className="browse__head">
        <div className="browse__container">
          <p className="browse__eyebrow">Find a place</p>
          <h1 className="browse__title">Skip the line, wherever you're going</h1>
          <p className="browse__lead">
            Search approved clinics, banks and offices, then join their queue
            from anywhere.
          </p>

          <form className="browse__search" role="search" onSubmit={(e) => e.preventDefault()}>
            <MagnifyingGlass size={22} className="browse__search-icon" aria-hidden="true" />
            <label htmlFor="browse-search" className="browse__sr-only">
              Search places
            </label>
            <input
              id="browse-search"
              type="search"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="browse__clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X size={18} weight="bold" />
              </button>
            )}
          </form>

          {categories.length > 0 && (
            <div className="browse__chips" role="group" aria-label="Filter by category">
              <button
                type="button"
                className={`browse__chip ${!categoryId ? "is-active" : ""}`}
                aria-pressed={!categoryId}
                onClick={() => selectCategory("")}
              >
                All
              </button>
              {categories.map((category) => {
                const active = String(category.id) === categoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`browse__chip ${active ? "is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => selectCategory(String(category.id))}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Results ---------- */}
      <section className="browse__results" aria-labelledby="browse-results-title">
        <div className="browse__container">
          <h2 id="browse-results-title" className="browse__sr-only">
            Results
          </h2>

          {results.status === "ready" && count > 0 && (
            <p className="browse__count" aria-live="polite">
              {count} {count === 1 ? "place" : "places"} found
            </p>
          )}

          {/* Loading */}
          {results.status === "loading" && (
            <div className="browse__grid" aria-busy="true" aria-label="Loading places">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="browse-card browse-card--skeleton" />
              ))}
            </div>
          )}

          {/* Error */}
          {results.status === "error" && (
            <div className="browse__message" role="alert">
              <h3>We couldn't load places</h3>
              <p>{results.error}. Check your connection and try again.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty */}
          {results.status === "ready" && count === 0 && (
            <div className="browse__message">
              <span className="browse__message-icon">
                <Storefront size={36} weight="duotone" />
              </span>
              <h3>No places found</h3>
              <p>Try another name or pick a different category.</p>
              {(search || categoryId) && (
                <button type="button" className="btn btn--outline" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Results */}
          {results.status === "ready" && count > 0 && (
            <div className="browse__grid">
              {results.items.map((business) => {
                const category = categoryName(business);
                const logo = business.image;

                return (
                  <Link
                    key={business.id}
                    to={`/businesses/${business.id}`}
                    className="browse-card"
                  >
                    <span className="browse-card__logo">
                      {logo ? <img src={logo} alt="" /> : business.name?.charAt(0)}
                    </span>

                    <div className="browse-card__body">
                      <h3>{business.name}</h3>
                      {category && <span className="browse-card__tag">{category}</span>}
                      {business.description && <p>{business.description}</p>}
                    </div>

                    <span className="browse-card__more">
                      View branches <ArrowRight size={16} weight="bold" />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}