import type { ReactElement, ReactNode, SVGProps } from "react";

// Professional line-icon set for the Frontier Cockpit Local.
//
// Standard, so every icon stays visually consistent:
// - 24x24 coordinate space
// - fill none, stroke currentColor, so icons inherit the nav color
// - stroke width 1.75, round caps and joins
// - solid marks (dots, handles) use fill currentColor with no stroke
//
// Icons are authored here as SVG paths. The project does not depend on any
// third-party icon package.

export type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: Readonly<IconProps & { children: ReactNode }>): ReactElement {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            {children}
        </svg>
    );
}

// Overview: a gauge, for a single glance at the whole system.
export function OverviewIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <path d="M4.5 16a7.5 7.5 0 0 1 15 0" />
            <path d="M12 16l3.6-4.1" />
            <circle cx="12" cy="16" r="1.15" fill="currentColor" stroke="none" />
        </IconBase>
    );
}

// Credits: a coin token, for AI Credits budget and model cost.
export function CreditsIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <circle cx="12" cy="12" r="8.25" />
            <circle cx="12" cy="12" r="3.7" />
            <path d="M12 3.75v1.6M12 18.65v1.6M3.75 12h1.6M18.65 12h1.6" />
        </IconBase>
    );
}

// Sessions: a list of rows, one per traced session.
export function SessionsIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <path d="M9 7h11M9 12h11M9 17h7" />
            <circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none" />
        </IconBase>
    );
}

// Workspaces: four tiles, for comparing multiple projects.
export function WorkspacesIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <rect x="4" y="4" width="7" height="7" rx="1.6" />
            <rect x="13" y="4" width="7" height="7" rx="1.6" />
            <rect x="4" y="13" width="7" height="7" rx="1.6" />
            <rect x="13" y="13" width="7" height="7" rx="1.6" />
        </IconBase>
    );
}

// Coach: sparkles, for AI recommendations.
export function CoachIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <path d="M11 4.5 12.4 8.1 16 9.5 12.4 10.9 11 14.5 9.6 10.9 6 9.5 9.6 8.1Z" />
            <path d="M17.75 14 18.5 15.85 20.35 16.6 18.5 17.35 17.75 19.2 17 17.35 15.15 16.6 17 15.85Z" />
        </IconBase>
    );
}

// History: a clock, for usage over time.
export function HistoryIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <circle cx="12" cy="12" r="8.25" />
            <path d="M12 7.4V12l3.1 1.9" />
        </IconBase>
    );
}

// Health: an ECG pulse, for stack health and data quality.
export function HealthIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <path d="M3.5 12H8l2-5 3.5 10 2-5h4.5" />
        </IconBase>
    );
}

// Settings: sliders, for tuning thresholds and the data boundary.
export function SettingsIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <path d="M7 4.5v15M12 4.5v15M17 4.5v15" />
            <circle cx="7" cy="9" r="2.05" fill="currentColor" stroke="none" />
            <circle cx="12" cy="15" r="2.05" fill="currentColor" stroke="none" />
            <circle cx="17" cy="8" r="2.05" fill="currentColor" stroke="none" />
        </IconBase>
    );
}

// Planner: a compass, for forecasting a workspace and justifying budget.
export function PlannerIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <circle cx="12" cy="12" r="8.25" />
            <path d="M15.2 8.8 13.4 13.4 8.8 15.2 10.6 10.6Z" />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </IconBase>
    );
}

// Check: an affirmative mark, for capabilities a plan includes.
export function CheckIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <path d="M5 12.5 9.5 17 19 6.5" />
        </IconBase>
    );
}

// Dash: a neutral mark, for capabilities a plan does not include.
export function DashIcon(props: Readonly<IconProps>): ReactElement {
    return (
        <IconBase {...props}>
            <path d="M6 12h12" />
        </IconBase>
    );
}

export const navIcons: Record<string, (props: Readonly<IconProps>) => ReactElement> = {
    overview: OverviewIcon,
    credits: CreditsIcon,
    sessions: SessionsIcon,
    workspaces: WorkspacesIcon,
    coach: CoachIcon,
    planner: PlannerIcon,
    history: HistoryIcon,
    health: HealthIcon,
    settings: SettingsIcon
};

export function NavIcon({ id, ...props }: Readonly<IconProps & { id: string }>): ReactElement {
    const Component = navIcons[id] ?? OverviewIcon;
    return <Component {...props} />;
}
