import { describe, it, expect } from "vitest"; // 전역 객체 사용 대신 모듈 임포트
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BirthDateTime, { type BirthValue } from "@/components/forms/BirthDateTime";

/**
 * TestHost
 * - 목적: BirthDateTime을 감싸서 내부 상태 변화를 관찰하기 위한 테스트용 호스트 컴포넌트
 * - 구현: value/onChange를 상태로 연결하고, 최종 값을 <output data-testid="state">로 노출
 * - 주의: initial로 전달된 값은 디폴트와 병합됨
 */
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
      {/* 테스트 대상 컴포넌트 */}
      <BirthDateTime value={value} onChange={setValue} />
      {/* 현재 상태를 JSON 문자열로 노출해 조회 용이 */}
      <output data-testid="state">{JSON.stringify(value)}</output>
    </>
  );
}

/**
 * getState
 * - 목적: TestHost가 노출한 JSON 상태를 파싱해 BirthValue 객체로 반환
 * - 사용: 각 it 블록에서 사용자 상호작용 이후의 최신 상태 검증
 */
function getState() {
  const json = screen.getByTestId("state").textContent || "{}";
  return JSON.parse(json) as BirthValue;
}

describe("BirthDateTime component", () => {
  it("연/월/일 선택 시 birthDate가 올바르게 조합된다", async () => {
    // 사용자의 실제 상호작용 시나리오를 시뮬레이션
    const user = userEvent.setup();
    render(<TestHost />);

    // 각 셀렉트는 data-testid로 직접 조회(레이블 변동에 영향 받지 않음)
    const year = screen.getByTestId("bdt-year") as HTMLSelectElement;
    const month = screen.getByTestId("bdt-month") as HTMLSelectElement;
    const day = screen.getByTestId("bdt-day") as HTMLSelectElement;

    // 2024-03-31로 선택
    await user.selectOptions(year, "2024");
    await user.selectOptions(month, "03");
    await user.selectOptions(day, "31");

    // 컴포넌트 내부 조합 값 검증
    const s = getState();
    expect(s.year).toBe("2024");
    expect(s.month).toBe("03");
    expect(s.day).toBe("31");
    expect(s.birthDate).toBe("2024-03-31");
  });

  it("월/연도 변경 시 일(day)이 자동 클램프된다 (윤년/비윤년 검증)", async () => {
    // 초기값: 2024-03-31 (31일)
    const user = userEvent.setup();
    render(<TestHost initial={{ year: "2024", month: "03", day: "31" }} />);

    const month = screen.getByTestId("bdt-month") as HTMLSelectElement;
    const year = screen.getByTestId("bdt-year") as HTMLSelectElement;

    // 2024-02로 변경 → 31일은 존재하지 않으므로 29로 클램프(윤년)
    await user.selectOptions(month, "02");
    let s = getState();
    expect(s.month).toBe("02");
    expect(s.day).toBe("29");
    expect(s.birthDate).toBe("2024-02-29"); // 윤년 검증

    // 연도를 2025로 변경 → 2월 29일이 없으므로 28로 클램프(비윤년)
    await user.selectOptions(year, "2025");
    s = getState();
    expect(s.year).toBe("2025");
    expect(s.month).toBe("02");
    expect(s.day).toBe("28");
    expect(s.birthDate).toBe("2025-02-28");
  });

  it("오전/오후·시·분으로 birthTime이 24시간 형식으로 조합된다", async () => {
    // AM/PM + 12시간제(hour12) + 분(minute) 입력을 24시간 형식(HH:mm)으로 변환하는지 검증
    const user = userEvent.setup();
    render(<TestHost />);

    const ampm = screen.getByTestId("bdt-ampm") as HTMLSelectElement;
    const hour = screen.getByTestId("bdt-hour") as HTMLSelectElement;
    const minute = screen.getByTestId("bdt-minute") as HTMLSelectElement;

    // PM 12:34 → 12:34
    await user.selectOptions(ampm, "PM");
    await user.selectOptions(hour, "12");
    await user.selectOptions(minute, "34");
    let s = getState();
    expect(s.birthTime).toBe("12:34");

    // AM 12:05 → 00:05 (자정 처리)
    await user.selectOptions(ampm, "AM");
    await user.selectOptions(hour, "12");
    await user.selectOptions(minute, "05");
    s = getState();
    expect(s.birthTime).toBe("00:05");

    // PM 01:05 → 13:05
    await user.selectOptions(ampm, "PM");
    await user.selectOptions(hour, "01");
    await user.selectOptions(minute, "05");
    s = getState();
    expect(s.birthTime).toBe("13:05");
  });

  it('"모름" 체크 시 시간 필드가 비활성화되고 birthTime이 undefined가 된다', async () => {
    // timeUnknown 체크박스 동작 및 필드 비활성화, birthTime 해제 로직 검증
    const user = userEvent.setup();
    render(<TestHost initial={{ ampm: "AM", hour12: "11", minute: "10" }} />);

    const unknown = screen.getByTestId("bdt-unknown") as HTMLInputElement;
    const ampm = screen.getByTestId("bdt-ampm") as HTMLSelectElement;
    const hour = screen.getByTestId("bdt-hour") as HTMLSelectElement;
    const minute = screen.getByTestId("bdt-minute") as HTMLSelectElement;

    // 초기 상태 확인
    let s = getState();
    expect(s.birthTime).toBe("11:10");

    // 모름 체크 → 시간 입력 비활성화 및 birthTime 제거
    await user.click(unknown);
    s = getState();
    expect(unknown.checked).toBe(true);
    expect(ampm.disabled).toBe(true);
    expect(hour.disabled).toBe(true);
    expect(minute.disabled).toBe(true);
    expect(s.birthTime).toBeUndefined();

    // 모름 해제 후 다시 입력 가능 여부 확인
    await user.click(unknown);
    await user.selectOptions(ampm, "PM");
    await user.selectOptions(hour, "01");
    await user.selectOptions(minute, "00");
    s = getState();
    expect(s.birthTime).toBe("13:00");
  });
});