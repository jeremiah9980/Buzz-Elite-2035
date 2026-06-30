# Bombers CMS Dashboard

This package adds a simple CMS dashboard for the Bombers site.

## Files

```text
bombers/
  admin/
    index.html
    admin.css
    admin.js
  content/
    bombers.json
  examples/
    homepage-example.html
    public-site-content-loader.js
```

## Dashboard URL

After uploading to your site, open:

```text
/bombers/admin/
```

## Starter Login

```text
Password: change-me
```

This password is only a starter client-side password. It is not secure for production because static files can be inspected in the browser. For production, protect `/bombers/admin/` with a real authentication layer such as Cloudflare Access, Netlify Identity, Firebase Auth, Supabase Auth, or server-side login.

## How Editing Works

1. Open `/bombers/admin/`.
2. Log in with the starter password.
3. Edit homepage, announcements, schedule, roster, sponsors, gallery, contact, or SEO content.
4. Click **Save in Browser** while working.
5. Click **Export JSON** when ready to publish.
6. Replace this file in the website repo:

```text
bombers/content/bombers.json
```

## Connecting the Public Site

Use `bombers/examples/public-site-content-loader.js` as a starting point.

Add data attributes to the public HTML where content should appear:

```html
<h1 data-bombers="heroTitle"></h1>
<p data-bombers="heroSubtitle"></p>
<a data-bombers="ctaLink" href="#">
  <span data-bombers="ctaText"></span>
</a>
<img data-bombers="heroImage" src="" alt="" />
<div data-bombers="announcements"></div>
```

Then include the loader script:

```html
<script src="/bombers/examples/public-site-content-loader.js"></script>
```

## Content Sections Included

- Site branding
- Homepage hero
- Announcements
- Schedule
- Roster
- Sponsors
- Gallery
- Contact information
- SEO metadata

## Recommended Production Upgrade

For a real CMS, replace JSON export/import with:

- Supabase Auth for login
- Supabase Postgres for content
- Supabase Storage for images
- Row-level security for admin-only edits

The current version is best for a static site MVP where one admin exports JSON and commits/uploads it to the website.
