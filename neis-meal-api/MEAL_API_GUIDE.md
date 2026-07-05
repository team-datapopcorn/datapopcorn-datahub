# School Meal Menu API Guide

## Overview
- **Category**: Education Conditions > School Meals
- **Data Release Date**: 2019-04-01
- **Tags**: School Meal Menu Information, School Meals, Meal Info, Menu Item Names
- **Provider**: Ministry of Education, 17 Office of Education
- **Update Cycle**: Daily
- **License**: Unrestricted Use

## Description
- Provides daily status of menu item names, origin information, calorie information, and nutritional information for school meals.
- **Numbers in Menu Names**: Indicate ingredients that may cause allergies.

### Allergy Information Codes
| No. | Ingredient | No. | Ingredient | No. | Ingredient |
| :---: | :--- | :---: | :--- | :---: | :--- |
| 1 | Eggs | 8 | Crab | 15 | Chicken |
| 2 | Milk | 9 | Shrimp | 16 | Beef |
| 3 | Buckwheat | 10 | Pork | 17 | Squid |
| 4 | Peanut | 11 | Peach | 18 | Shellfish (Oyster, Abalone, Mussel) |
| 5 | Soybean | 12 | Tomato | 19 | Pine Nut |
| 6 | Wheat | 13 | Sulfites | | |
| 7 | Mackerel | 14 | Walnut | | |

---

## Basic Parameters

| Parameter | Type | Required | Description | Default / Notes |
| :--- | :--- | :---: | :--- | :--- |
| **KEY** | STRING | Yes | Authentication Key | Sample key available |
| **Type** | STRING | Yes | Response Type (xml, json) | Default: `xml` |
| **pIndex** | INTEGER | Yes | Page Index | Default: `1` (Fixed for sample key) |
| **pSize** | INTEGER | Yes | Page Size | Default: `100` (Fixed at 5 for sample key) |

## Request Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| **ATPT_OFCDC_SC_CODE** | STRING | **Yes** | City/Province Office of Education Code |
| **SD_SCHUL_CODE** | STRING | **Yes** | Standard School Code |
| **MMEAL_SC_CODE** | STRING | Optional | Meal Code |
| **MLSV_YMD** | STRING | Optional | Meal Date |
| **MLSV_FROM_YMD** | STRING | Optional | Meal Start Date |
| **MLSV_TO_YMD** | STRING | Optional | Meal End Date |

---

## Output Parameters

| No | Field Name | Description |
| :---: | :--- | :--- |
| 1 | **ATPT_OFCDC_SC_CODE** | City/Province Office of Education Code |
| 2 | **ATPT_OFCDC_SC_NM** | City/Province Office of Education Name |
| 3 | **SD_SCHUL_CODE** | Standard School Code |
| 4 | **SCHUL_NM** | School Name |
| 5 | **MMEAL_SC_CODE** | Meal Code |
| 6 | **MMEAL_SC_NM** | Meal Name |
| 7 | **MLSV_YMD** | Meal Date |
| 8 | **MLSV_FGR** | Number of Meals Served |
| 9 | **DDISH_NM** | Menu Item Names |
| 10 | **ORPLC_INFO** | Origin Information |
| 11 | **CAL_INFO** | Calorie Information |
| 12 | **NTR_INFO** | Nutritional Information |
| 13 | **MLSV_FROM_YMD** | Meal Start Date |
| 14 | **MLSV_TO_YMD** | Meal End Date |
| 15 | **LOAD_DTM** | Modification Date |
