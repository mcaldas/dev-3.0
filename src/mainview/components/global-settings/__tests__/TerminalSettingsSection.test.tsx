import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, type TFunction } from "../../../i18n";
import TerminalSettingsSection from "../TerminalSettingsSection";
import {
	bootstrapTerminalFont,
	DEFAULT_TERMINAL_FONT_SIZE,
	getTerminalFontFamily,
	getTerminalFontSize,
} from "../../../terminal-font";

const t = Object.assign((key: string) => key, {
	plural: (key: string, count: number) => `${key}|${count}`,
}) as unknown as TFunction;

function renderSection(family = "", size = DEFAULT_TERMINAL_FONT_SIZE) {
	render(
		<I18nProvider>
			<TerminalSettingsSection
				t={t}
				scrollSpeed={2}
				terminalFontFamily={family}
				terminalFontSize={size}
				newTaskTerminalBackend="tmux"
				nativeTerminalAvailability={null}
				terminalPathOpenMode="preview"
				onNewTaskTerminalBackendChange={vi.fn()}
				onTerminalPathOpenModeChange={vi.fn()}
			/>
		</I18nProvider>,
	);
}

beforeEach(() => {
	localStorage.clear();
	bootstrapTerminalFont();
});

const realCreateElement = document.createElement;

afterEach(() => vi.restoreAllMocks());

describe("terminal font controls", () => {
	it("commits a family the app never shipped in its list", async () => {
		// The whole point of `allowCustom`: our shortlist cannot know what this
		// machine has installed, so typing a family must be enough.
		renderSection();
		const user = userEvent.setup();

		await user.click(screen.getByLabelText("settings.terminalFontFamily", { selector: "button" }));
		await user.type(screen.getByLabelText("settings.terminalFontFamily", { selector: "input" }), "Comic Mono");
		await user.click(screen.getByText(/Comic Mono/));

		expect(getTerminalFontFamily()).toBe("Comic Mono");
	});

	it("warns when the chosen family is not on this device, and stays quiet otherwise", () => {
		// Widths keyed off the first resolvable family, like a real canvas: a missing
		// family measures as its generic, an installed one does not.
		function stubCanvas(installed: string[]) {
			const widths: Record<string, number> = { monospace: 100, serif: 130, "sans-serif": 160 };
			const ctx = {
				font: "",
				measureText: () => {
					const families = ctx.font.replace(/^\d+px\s*/, "").split(",").map((f) => f.trim().replace(/^'|'$/g, ""));
					const hit = families.find((f) => installed.includes(f) || f in widths);
					return { width: hit && hit in widths ? widths[hit] : 999 };
				},
			};
			vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
				tag === "canvas" ? { getContext: () => ctx } : realCreateElement.call(document, tag)) as never);
		}

		stubCanvas([]);
		renderSection("Nope Mono");
		expect(screen.getByText("settings.terminalFontMissing")).toBeTruthy();

		stubCanvas(["Menlo"]);
		renderSection("Menlo");
		// Still exactly the one from the first render — the second one stays quiet.
		expect(screen.queryAllByText("settings.terminalFontMissing")).toHaveLength(1);
	});

	it("the size slider writes through to the preference", () => {
		renderSection();
		const slider = screen.getByLabelText("settings.terminalFontSize") as HTMLInputElement;
		expect(slider.value).toBe(String(DEFAULT_TERMINAL_FONT_SIZE));

		fireEvent.change(slider, { target: { value: "22" } });

		expect(getTerminalFontSize()).toBe(22);
	});

	it("both resets are dead while the settings are already at their defaults", () => {
		renderSection();
		const resets = screen.getAllByText("settings.zoomReset") as HTMLButtonElement[];
		// Font family, font size, scroll speed — scroll speed is at its default too.
		for (const reset of resets) expect(reset.hasAttribute("disabled")).toBe(true);
	});
});
