export default function Privacy() {
  return (
    <article className="page-content" style={{ maxWidth: 850 }}>
      <div className="page-head">
        <h1>
          Your space.
          <br />
          <em>Your privacy.</em>
        </h1>
        <p>
          Product privacy summary — deployment owners must publish their
          operator contact and retention policy before public launch.
        </p>
      </div>
      <div className="panel">
        <h3>What is public</h3>
        <p>
          Your display name, username, biography, learning interests, skills,
          and teaching interests are visible on your profile. Public sessions,
          requests, circles, and follows are visible to other visitors. Unlisted
          session pages are readable by anyone who has their page URL.
        </p>
        <h3>What stays restricted</h3>
        <p>
          Email authentication is managed by Firebase Authentication. Academic
          details remain private unless you opt into publishing them. Meeting
          URLs are stored separately and revealed only through authorization
          checks. Discussions are restricted to approved session or circle
          members.
        </p>
        <h3>Your choices</h3>
        <p>
          Edit your profile, hide academic details, cancel registrations, delete
          your messages, block users, and mute in-app notifications from your
          dashboard. Account deletion and data export need an operator-assisted
          process in this release.
        </p>
        <h3>External services</h3>
        <p>
          Joining a meeting opens an external provider with its own privacy
          terms. Fonts are requested from Google Fonts; local serif and
          sans-serif fallbacks remain available. No paid AI service is used. If
          enabled, description assistance sends only the supplied title and
          notes to the operator’s local Ollama instance.
        </p>
        <h3>Cookies and notifications</h3>
        <p>
          Authentication uses session cookies. Theme preference is stored in
          your browser. Notifications in this release are in-app; there is no
          closed-browser push delivery.
        </p>
      </div>
    </article>
  );
}
