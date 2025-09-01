import { describe, it, expect } from "vitest"; // ✅ 전역 대신 모듈 임포트
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BirthDateTime, { type BirthValue } from "@/components/forms/BirthDateTime";

function TestHost(props: { initial?: Partial<BirthValue> }) {
  const [value, setValue] = React.useState<BirthValue>({
    year: undefined,
    month: undefined,
    day: undefined,
    ampm: undefined,
    hour12: undefined,
    minute: undefined,
    timeUnknown: false,
    ...props.initial,
  });
  return (
    <>
      <BirthDateTime value={value} onChange={setValue} />
      <output data-testid="state">{JSON.stringify(value)}</output>
    </>
  );
}

function getState() {
  const json = screen.getByTestId("state").textContent || "{}";
  return JSON.parse(json) as BirthValue;
}

describe("BirthDateTime component", () => {
  it("연/월/일 선택 시 birthDate가 올바르게 조합된다", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const year = screen.getByTestId("bdt-year") as HTMLSelectElement;
    const month = screen.getByTestId("bdt-month") as HTMLSelectElement;
    const day = screen.getByTestId("bdt-day") as HTMLSelectElement;

    await user.selectOptions(year, "2024");
    await user.selectOptions(month, "03");
    await user.selectOptions(day, "31");

    const s = getState();
    expect(s.year).toBe("2024");
    expect(s.month).toBe("03");
    expect(s.day).toBe("31");
    expect(s.birthDate).toBe("2024-03-31");
  });

  it("월/연도 변경 시 일(day)이 자동 클램프된다 (윤년/비윤년 검증)", async () => {
    const user = userEvent.setup();
    render(<TestHost initial={{ year: "2024", month: "03", day: "31" }} />);

    const month = screen.getByTestId("bdt-month") as HTMLSelectElement;
    const year = screen.getByTestId("bdt-year") as HTMLSelectElement;

    // 2024-02로 변경 → 31 → 29로 클램프
    await user.selectOptions(month, "02");
    let s = getState();
    expect(s.month).toBe("02");
    expect(s.day).toBe("29");
    expect(s.birthDate).toBe("2024-02-29"); // 윤년

    // 2025로 변경 → 2월 29 → 28로 클램프
    await user.selectOptions(year, "2025");
    s = getState();
    expect(s.year).toBe("2025");
    expect(s.month).toBe("02");
    expect(s.day).toBe("28");
    expect(s.birthDate).toBe("2025-02-28");
  });

  it("오전/오후·시·분으로 birthTime이 24시간 형식으로 조합된다", async () => {
    const user = userEvent.setup();
    render(<TestHost />);

    const ampm = screen.getByTestId("bdt-ampm") as HTMLSelectElement;
    const hour = screen.getByTestId("bdt-hour") as HTMLSelectElement;
    const minute = screen.getByTestId("bdt-minute") as HTMLSelectElement;

    await user.selectOptions(ampm, "PM");
    await user.selectOptions(hour, "12");
    await user.selectOptions(minute, "34");
    let s = getState();
    expect(s.birthTime).toBe("12:34");

    await user.selectOptions(ampm, "AM");
    await user.selectOptions(hour, "12");
    await user.selectOptions(minute, "05");
    s = getState();
    expect(s.birthTime).toBe("00:05");

    await user.selectOptions(ampm, "PM");
    await user.selectOptions(hour, "01");
    await user.selectOptions(minute, "05");
    s = getState();
    expect(s.birthTime).toBe("13:05");
  });

  it('"모름" 체크 시 시간 필드가 비활성화되고 birthTime이 undefined가 된다', async () => {
    const user = userEvent.setup();
    render(<TestHost initial={{ ampm: "AM", hour12: "11", minute: "10" }} />);

    const unknown = screen.getByTestId("bdt-unknown") as HTMLInputElement;
    const ampm = screen.getByTestId("bdt-ampm") as HTMLSelectElement;
    const hour = screen.getByTestId("bdt-hour") as HTMLSelectElement;
    const minute = screen.getByTestId("bdt-minute") as HTMLSelectElement;

    let s = getState();
    expect(s.birthTime).toBe("11:10");

    await user.click(unknown);
    s = getState();
    expect(unknown.checked).toBe(true);
    expect(ampm.disabled).toBe(true);
    expect(hour.disabled).toBe(true);
    expect(minute.disabled).toBe(true);
    expect(s.birthTime).toBeUndefined();

    await user.click(unknown);
    await user.selectOptions(ampm, "PM");
    await user.selectOptions(hour, "01");
    await user.selectOptions(minute, "00");
    s = getState();
    expect(s.birthTime).toBe("13:00");
  });
});