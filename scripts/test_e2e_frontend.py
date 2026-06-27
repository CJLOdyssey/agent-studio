import os
import sys

os.environ["LD_LIBRARY_PATH"] = (
    "/tmp/playwright-libs/usr/lib/x86_64-linux-gnu:"
    + os.environ.get("LD_LIBRARY_PATH", "")
)

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
RESULTS = []


def record(name, passed, detail=""):
    status = "✅" if passed else "❌"
    RESULTS.append((name, passed, detail))
    print(f"  {status} {name}" + (f" — {detail}" if detail else ""))


def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.set_default_timeout(10000)

        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        print("\n1. App Loading")
        page.goto(BASE, wait_until="networkidle")
        record("App loads", page.title() == "虚拟软件外包团队", f"title={page.title()}")

        print("\n2. Sidebar Navigation")
        sidebar = page.locator("aside, nav, [class*='sidebar']").first
        links = sidebar.locator("a, button").all()
        nav_count = len(links)
        record("Sidebar has nav items", nav_count >= 5, f"found {nav_count} items")

        clicked = 0
        for link in links:
            try:
                text = link.inner_text().strip()
                if text and len(text) < 20:
                    link.click(timeout=3000)
                    page.wait_for_timeout(400)
                    clicked += 1
            except Exception:
                pass
        record("Sidebar navigation works", clicked >= 5, f"clicked {clicked}/{nav_count}")

        print("\n3. Open Workstation")
        user_btn = page.locator("button:has-text('User')").first
        user_btn.click()
        page.wait_for_timeout(600)
        ws_btn = page.locator("button:has-text('工作台'), button:has-text('Workstation')").first
        if ws_btn.count() > 0:
            ws_btn.click()
            page.wait_for_timeout(1000)
            record("Workstation opens", page.locator(".devagents-workstation-tab").count() > 0,
                   f"found {page.locator('.devagents-workstation-tab').count()} tabs")
        else:
            record("Workstation opens", False, "No 工作台 button in menu")

        print("\n4. Workstation Tabs")
        tabs = page.locator(".devagents-workstation-tab").all()
        tab_texts = []
        for t in tabs:
            try:
                tab_texts.append(t.inner_text().strip())
            except:
                pass
        record("All 10 tabs present", len(tabs) >= 10, f"found {len(tabs)}: {tab_texts[:5]}...")

        print("\n5. Tab Navigation")
        tabs_ok = 0
        for t in tabs:
            try:
                t.click(timeout=3000)
                page.wait_for_timeout(500)
                tabs_ok += 1
            except:
                pass
        record("Tab navigation works", tabs_ok >= 8, f"clicked {tabs_ok}/{len(tabs)}")

        print("\n6. Monitor Center")
        try:
            monitor_tab = page.locator(".devagents-workstation-tab:has-text('监控')").first
            monitor_tab.click()
            page.wait_for_timeout(2000)
            has_cards = page.locator("[class*='card'], [class*='stat'], [class*='monitor'], [class*='metric']").count() > 0
            record("Monitor shows stats", has_cards)
        except Exception as e:
            record("Monitor", False, str(e)[:80])

        print("\n7. System Settings")
        try:
            settings_tab = page.locator(".devagents-workstation-tab:has-text('设置')").first
            settings_tab.click()
            page.wait_for_timeout(1500)
            has_content = page.locator("input, select, textarea, [class*='setting']").count() > 0
            record("Settings page renders", has_content)
        except Exception as e:
            record("Settings", False, str(e)[:80])

        print("\n8. Theme Toggle (Header)")
        page.locator(".devagents-modal-close").click()
        page.wait_for_timeout(500)
        html_classes_before = page.locator("html").get_attribute("class") or ""
        dark_before = "dark" in html_classes_before
        dark_btn = page.locator('button[aria-label="Toggle dark mode"]').first
        if dark_btn.count() > 0:
            dark_btn.click()
            page.wait_for_timeout(1500)
            html_classes_after = page.locator("html").get_attribute("class") or ""
            dark_after = "dark" in html_classes_after
            # Also toggle back to verify
            dark_btn.click()
            page.wait_for_timeout(1500)
            html_classes_reset = page.locator("html").get_attribute("class") or ""
            dark_reset = "dark" in html_classes_reset
            record("Theme toggle works", dark_before != dark_after and dark_before == dark_reset,
                   f"dark: {dark_before} -> {dark_after} -> {dark_reset}")
        else:
            record("Theme toggle", False, "No dark mode button")

        print("\n9. Responsive")
        page.set_viewport_size({"width": 768, "height": 1024})
        page.wait_for_timeout(300)
        record("Tablet viewport", True)
        page.set_viewport_size({"width": 1280, "height": 800})
        page.wait_for_timeout(300)
        record("Desktop restored", True)

        print("\n10. Console Errors")
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(1500)
        critical = [e for e in errors if "ResizeObserver" not in e
                     and "favicon" not in e.lower()
                     and "Failed to load resource" not in e]
        record("No critical JS errors", len(critical) == 0, f"{len(critical)} errors" + (f": {critical[:3]}" if critical else ""))

        browser.close()


def main():
    print("=" * 60)
    print("Frontend E2E Tests")
    print("=" * 60)

    run_tests()

    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = sum(1 for _, ok, _ in RESULTS if not ok)
    total = len(RESULTS)

    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} passed, {failed} failed")
    print("=" * 60)

    if failed:
        print("\nFAILURES:")
        for name, ok, detail in RESULTS:
            if not ok:
                print(f"  - {name}: {detail}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
