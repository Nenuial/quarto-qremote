# qremote.nenuial.org

Source of the QRemote website: documentation of the extension and the apps, support, privacy policy
(English and French), and a demo presentation.

```sh
quarto preview     # live preview
quarto render      # builds _site/
```

Deploy: upload the contents of `_site/` to the web server's document root for qremote.nenuial.org.
It is a static site; no server-side code.

The App Store records link to these pages, so keep their addresses stable:

| Page | URL |
|---|---|
| Support | https://qremote.nenuial.org/support.html |
| Privacy policy | https://qremote.nenuial.org/privacy.html |
| Politique de confidentialité | https://qremote.nenuial.org/privacy-fr.html |

## Images

`python3 images/build.py` rebuilds the images from the screenshot captures of `qremote-ios`
(`docs/screenshots/raw/`, repository checked out next to this one). iPhone and Mac images come in
`-light` and `-dark` versions; the pages show the one matching the site's theme with Quarto's
`.light-content` / `.dark-content` classes. The watch is always dark, so it has one version.

## Notes

- `_extensions/` is copied from the repository's `_extensions/` before each render
  (`_scripts/copy-extension.py`), so the demo uses the current extension. It is not checked in, and
  must not be a symbolic link: Quarto Wizard refuses to install from an archive that contains one.
  The demo has `relay: false`: on a public page, a link to `localhost` would make browsers ask for
  local network access.
- The site loads nothing from other servers (no web fonts, no CDN, no analytics), as the privacy
  policy states. Keep it that way, or update the policy.
- Theme: Rosé Pine Dawn (light) and Moon (dark), in `theme/`; it follows the visitor's system setting.
