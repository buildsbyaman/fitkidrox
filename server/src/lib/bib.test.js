import { describe, expect, it } from 'vitest'
import {
  calculateHeatAndCourse,
  DEFAULT_BIB_CONFIG,
  resolveCategoryConfig,
} from './bib.js'

describe('Bib Number Generation & Heat/Course Logic', () => {
  it('correctly maps all 4 categories to prefixes, ranges, and heat sizes', () => {
    expect(DEFAULT_BIB_CONFIG['Mini FITKIDROX']).toMatchObject({
      prefix: 1,
      minBib: 1001,
      maxBib: 1250,
      reservedCount: 50,
      heatSize: 8,
    })

    expect(DEFAULT_BIB_CONFIG['Kids Fitness Challenge']).toMatchObject({
      prefix: 2,
      minBib: 2001,
      maxBib: 2400,
      reservedCount: 50,
      heatSize: 10,
    })

    expect(DEFAULT_BIB_CONFIG['Athletic Challenge']).toMatchObject({
      prefix: 3,
      minBib: 3001,
      maxBib: 3400,
      reservedCount: 50,
      heatSize: 10,
    })

    expect(DEFAULT_BIB_CONFIG['Performance FITKIDROX']).toMatchObject({
      prefix: 4,
      minBib: 4001,
      maxBib: 4200,
      reservedCount: 50,
      heatSize: 8,
    })
  })

  it('matches prompt example: Bib 2047 -> Kids Fitness, Heat 5, Course A', () => {
    const result = calculateHeatAndCourse(2047, 'Kids Fitness Challenge')
    expect(result.prefix).toBe(2)
    expect(result.serialNumber).toBe(47)
    expect(result.heatSize).toBe(10)
    expect(result.heat).toBe(5) // Math.ceil(47 / 10) = 5
    expect(result.course).toBe('Course A') // odd heat
    expect(result.courseCode).toBe('A')
  })

  it('assigns Course B for even-numbered heats', () => {
    // Bib 2012 -> serial 12, heatSize 10 -> heat 2 -> even -> Course B
    const result = calculateHeatAndCourse(2012, 'Kids Fitness Challenge')
    expect(result.heat).toBe(2)
    expect(result.course).toBe('Course B')
    expect(result.courseCode).toBe('B')
  })

  it('calculates heats correctly for Mini FITKIDROX (heatSize 8)', () => {
    // Bib 1001: serial 1, heatSize 8 -> heat 1 -> Course A
    const r1 = calculateHeatAndCourse(1001, 'Mini FITKIDROX')
    expect(r1.heat).toBe(1)
    expect(r1.course).toBe('Course A')

    // Bib 1008: serial 8, heatSize 8 -> heat 1 -> Course A
    const r8 = calculateHeatAndCourse(1008, 'Mini FITKIDROX')
    expect(r8.heat).toBe(1)
    expect(r8.course).toBe('Course A')

    // Bib 1009: serial 9, heatSize 8 -> heat 2 -> Course B
    const r9 = calculateHeatAndCourse(1009, 'Mini FITKIDROX')
    expect(r9.heat).toBe(2)
    expect(r9.course).toBe('Course B')
  })

  it('infers category from bib prefix when category is not supplied', () => {
    const res = calculateHeatAndCourse(3015)
    expect(res.prefix).toBe(3)
    expect(res.categoryName).toBe('Athletic Challenge')
    expect(res.heatSize).toBe(10)
    expect(res.heat).toBe(2) // Math.ceil(15 / 10) = 2
    expect(res.course).toBe('Course B')
  })

  it('resolves categories by case-insensitive name, keywords, or DOB', () => {
    expect(resolveCategoryConfig('mini fitkidrox')?.prefix).toBe(1)
    expect(resolveCategoryConfig('Kids Fitness Challenge (ages 6–8)')?.prefix).toBe(2)
    expect(resolveCategoryConfig('athletic')?.prefix).toBe(3)
    expect(resolveCategoryConfig('Performance FITKIDROX')?.prefix).toBe(4)

    // By DOB on event day 2026-11-28:
    // Born 2022-01-01 -> Age 4 -> Mini (1)
    expect(resolveCategoryConfig('', '2022-01-01')?.prefix).toBe(1)
    // Born 2019-01-01 -> Age 7 -> Kids (2)
    expect(resolveCategoryConfig('', '2019-01-01')?.prefix).toBe(2)
    // Born 2015-01-01 -> Age 11 -> Athletic (3)
    expect(resolveCategoryConfig('', '2015-01-01')?.prefix).toBe(3)
    // Born 2011-01-01 -> Age 15 -> Performance (4)
    expect(resolveCategoryConfig('', '2011-01-01')?.prefix).toBe(4)
  })
})
