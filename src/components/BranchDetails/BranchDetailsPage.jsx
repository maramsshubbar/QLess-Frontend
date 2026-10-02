import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Clock, MapPin, Megaphone, Phone } from "@phosphor-icons/react";
import { getBusiness, getBusinessAnnouncements } from "../../services/businessService";
import {
  getBranch,
  getBranchHours,
  getBranchQueues,
  getBranchServices,
} from "../../services/branchService";
import "../Details/Details.css";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const TODAY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
  new Date().getDay()
];

const QUEUE_STATUS = {
  open: { label: "Open", className: "dt__status--open" },
  paused: { label: "Paused", className: "dt__status--paused" },
  closed: { label: "Closed", className: "dt__status--closed" },
};

// "09:00:00" -> "9:00 AM"
function formatTime(value) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function BranchDetailsPage() {
  const { branchId } = useParams();
  const [page, setPage] = useState({ status: "loading", error: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setPage({ status: "loading", error: "" });

    async function load() {
      // 1. the branch tells us which business it belongs to
      const branch = await getBranch(branchId, { signal });

      // 2. everything else at the same time
      const [business, services, hours, queues, announcements] = await Promise.all([
        getBusiness(branch.business_id, { signal }),
        getBranchServices(branchId, { signal }),
        getBranchHours(branchId, { signal }),
        getBranchQueues(branchId, { signal }),
        getBusinessAnnouncements(branch.business_id, { branchId, signal }).catch(() => []),
      ]);

      setPage({ status: "ready", branch, business, services, hours, queues, announcements });
    }

    load().catch((err) => {
      if (err.name === "AbortError") return;
      setPage({
        status: err.status === 404 ? "notfound" : "error",
        error: err.message,
      });
    });

    return () => controller.abort();
  }, [branchId, reloadKey]);

  // Refresh the queue numbers every 30 seconds while the page is open
  useEffect(() => {
    if (page.status !== "ready") return;

    const id = setInterval(() => {
      getBranchQueues(branchId)
        .then((queues) => setPage((prev) => ({ ...prev, queues })))
        .catch(() => {
          // keep showing the last numbers if a refresh fails
        });
    }, 30000);

    return () => clearInterval(id);
  }, [branchId, page.status]);

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
            <h1>This branch isn't available</h1>
            <p>It may have been closed or removed.</p>
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
            <h1>We couldn't load this branch</h1>
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
  const { branch, business, services, hours, queues, announcements } = page;
  const serviceName = (id) => services.find((s) => s.id === id)?.name;
  const hoursByDay = Object.fromEntries(hours.map((h) => [h.day_of_week, h]));

  return (
    <main className="dt">
      <div className="dt__container">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb">
          <ol className="dt__crumbs">
            <li>
              <Link to="/businesses">All places</Link>
            </li>
            <li>
              <Link to={`/businesses/${business.id}`}>{business.name}</Link>
            </li>
            <li>
              <span aria-current="page">{branch.name}</span>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <header className="dt__header">
          <span className="dt__logo">
            {branch.image || business.image ? (
              <img src={branch.image || business.image} alt="" />
            ) : (
              business.name.charAt(0)
            )}
          </span>

          <div className="dt__header-body">
            <Link className="dt__parent" to={`/businesses/${business.id}`}>
              {business.name}
            </Link>

            <h1 className="dt__title">{branch.name}</h1>

            <div className="dt__row">
              <span
                className={`dt__status ${branch.is_open_now ? "dt__status--open" : "dt__status--closed"
                  }`}
              >
                {branch.is_open_now ? "Open now" : "Closed now"}
              </span>
            </div>

            <ul className="dt__meta">
              {branch.address && (
                <li>
                  <MapPin size={16} />
                  {branch.address}
                </li>
              )}
              {branch.phone && (
                <li>
                  <Phone size={16} />
                  <a href={`tel:${branch.phone}`}>{branch.phone}</a>
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

        <div className="dt__layout">
          <div>
            {/* Queues */}
            <section className="dt__section" aria-labelledby="queues-title">
              <div className="dt__section-head">
                <h2 id="queues-title">Queues</h2>
                <span>Updates every 30 seconds</span>
              </div>

              {queues.length === 0 ? (
                <p className="dt__empty">This branch has no queues yet.</p>
              ) : (
                <ul className="dt__queues">
                  {queues.map((queue) => {
                    const status = QUEUE_STATUS[queue.status] || QUEUE_STATUS.closed;
                    const isOpen = queue.status === "open";
                    const wait = queue.waiting_count * queue.average_service_minutes;
                    const service = serviceName(queue.service_id);

                    return (
                      <li key={queue.id} className={`dt-queue ${isOpen ? "is-open" : ""}`}>
                        <div className="dt-queue__info">
                          <div className="dt__row">
                            <span className={`dt__status ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                          <h3>{queue.name}</h3>
                          {service && <p>{service}</p>}
                        </div>

                        <div className="dt-queue__stats">
                          <div>
                            <strong>{queue.waiting_count}</strong>
                            <span>waiting</span>
                          </div>
                          <div>
                            <strong>~{wait}</strong>
                            <span>min wait</span>
                          </div>
                        </div>

                        {isOpen ? (
                          <Link className="btn btn--primary" to={`/queues/${queue.id}`}>
                            Join queue
                          </Link>
                        ) : (
                          <span className="btn dt__btn-off" aria-disabled="true">
                            {queue.status === "paused" ? "Paused" : "Closed"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Services */}
            <section className="dt__section" aria-labelledby="services-title">
              <div className="dt__section-head">
                <h2 id="services-title">Services</h2>
                <span>
                  {services.length} {services.length === 1 ? "service" : "services"}
                </span>
              </div>

              {services.length === 0 ? (
                <p className="dt__empty">No services listed yet.</p>
              ) : (
                <ul className="dt__services">
                  {services.map((service) => (
                    <li key={service.id} className="dt-service">
                      <div>
                        <strong>{service.name}</strong>
                        {service.description && <p>{service.description}</p>}
                      </div>
                      {service.duration_minutes && (
                        <span className="dt-service__time">
                          About {service.duration_minutes} min
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Opening hours */}
          <aside className="dt__aside">
            <section className="dt-hours" aria-labelledby="hours-title">
              <h2 id="hours-title">
                <Clock size={20} weight="duotone" />
                Opening hours
              </h2>

              {hours.length === 0 ? (
                <p className="dt__empty">Hours not added yet.</p>
              ) : (
                <ul>
                  {DAYS.map((day) => {
                    const h = hoursByDay[day];
                    const closed = !h || h.is_closed;
                    return (
                      <li
                        key={day}
                        className={`${day === TODAY ? "is-today" : ""} ${closed ? "is-closed" : ""}`}
                        aria-current={day === TODAY ? "date" : undefined}
                      >
                        <span>{day}</span>
                        <span>
                          {closed
                            ? "Closed"
                            : `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}