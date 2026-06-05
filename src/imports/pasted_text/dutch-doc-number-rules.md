There are **two different things** people often call “the equation,” but they are not the same:

1. **Dutch document-number format rule**: what characters are allowed in the visible document number.
2. **MRZ check-digit rule**: the international ICAO checksum used in the machine-readable zone.

The **MRZ check-digit equation did not change** between Dutch models. What changed is mainly the **allowed characters in the Dutch document number**, especially the use of `0`.

## The clean distinction

| Period / model                         | Applies to                                                                                                        |                                                 Document-number structure | `O` allowed? | `0` allowed? | Important result                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------: | -----------: | -----------: | ----------------------------------------------------------------------------------- |
| **Model 2014, old numbering rule**     | Dutch passports and ID cards issued from the 2014 model until **30 Nov 2019**                                     | 9 chars: letters in pos. 1–2, letters/digits in pos. 3–8, digit in pos. 9 |           No |      **Yes** | A number ending in `0`, like `IM8H94990`, can be format-valid in this older period. |
| **Model 2014, updated numbering rule** | Dutch passports and ID cards newly issued from **1 Dec 2019** until the 2021 model rollout                        |                                                Same 9-character structure |           No |       **No** | A 2020 Dutch ID/passport should **not** contain `0`.                                |
| **Model 2021 ID card**                 | Dutch ID cards from **2 Aug 2021** onward                                                                         |                                                Same 9-character structure |           No |           No | Same no-`O`, no-`0` rule.                                                           |
| **Model 2021 passports**               | National passport and refugee travel document from **30 Aug 2021**; other passport models phased in November 2021 |                                                Same 9-character structure |           No |           No | Same no-`O`, no-`0` rule.                                                           |
| **Model 2024 passports**               | Newer passport model                                                                                              |                                       Same practical document-number rule |           No |           No | Still no `O` and no `0`.                                                            |

RvIG says the general document-number layout is: **positions 1 and 2 letters, positions 3 through 8 letters or digits, position 9 a digit**. It also says the letter **O** never occurs, and since **1 December 2019** the digit **0** is also no longer used in newly issued Dutch passports and Dutch identity cards. ([RvIG][1])

## Why 2020 is the confusing year

A **2020 Dutch ID card is still physically the 2014 model**, because the new Dutch ID card model was introduced only on **2 August 2021**. ([RvIG][2])

But a 2020 Dutch ID card already falls under the **post-1-December-2019 document-number rule**, meaning:

**2020 ID card = 2014 physical model + no `0` in the document number.**

So for your example:

| Number      | Old 2014 pre-Dec-2019 rule |                     2020 rule | Conclusion                                                |
| ----------- | -------------------------: | ----------------------------: | --------------------------------------------------------- |
| `IM8H94990` |          Could pass format | Fails because it contains `0` | Not valid for a newly issued 2020 Dutch ID                |
| `DVSQUMFE3` |              Passes format |            Passes no-`0` rule | Format-plausible for 2020, but not proof of real issuance |

## Which documents fall under which model?

### Dutch ID cards

| Issue date                  | Model              | Number rule             |
| --------------------------- | ------------------ | ----------------------- |
| 9 March 2014 to 30 Nov 2019 | ID card model 2014 | `0` possible, `O` never |
| 1 Dec 2019 to 1 Aug 2021    | ID card model 2014 | `0` not used, `O` never |
| From 2 Aug 2021 onward      | ID card model 2021 | `0` not used, `O` never |

The 2021 Dutch ID card model was introduced from **2 August 2021**. It has a visible document number at the top right, with the same 9-character structure and with neither `O` nor `0` used. ([RvIG][2])

### Dutch passports

| Issue date                                                         | Model                              | Number rule             |
| ------------------------------------------------------------------ | ---------------------------------- | ----------------------- |
| 9 March 2014 to 30 Nov 2019                                        | Passport model 2014                | `0` possible, `O` never |
| 1 Dec 2019 to 29 Aug 2021 for national passport                    | Passport model 2014                | `0` not used, `O` never |
| From 30 Aug 2021 for national passport and refugee travel document | Passport model 2021                | `0` not used, `O` never |
| November 2021 onward for several other passport models             | Passport model 2021 phased rollout | `0` not used, `O` never |

RvIG says the new **national passport** model was introduced on **30 August 2021**, with other passport models phased in later in 2021. ([RvIG][3])

## The MRZ equation is separate

The **MRZ check digit** is an international ICAO Doc 9303 rule. It checks whether the MRZ line was typed/read consistently, not whether the document number was genuinely issued by the Dutch government. ICAO Doc 9303 defines check digits in the MRZ for fields such as the document number. ([ICAO][4])

That means a number can be:

**MRZ checksum-valid but Dutch issuance-rule-invalid.**

That is exactly the trap with `IM8H94990`: it can look mathematically consistent in an MRZ-style checksum, but for a **2020 Dutch ID card**, it fails the Dutch rule because it contains `0` after 1 December 2019.

[1]: https://www.rvig.nl/node/356?utm_source=chatgpt.com "Hoe is het paspoortnummer of identiteitskaartnummer ..."
[2]: https://www.rvig.nl/kenmerken-identiteitskaart-2021?utm_source=chatgpt.com "Kenmerken Nederlandse identiteitskaart 2021"
[3]: https://www.rvig.nl/kenmerken-paspoorten-2021?utm_source=chatgpt.com "Kenmerkenbrochure Nederlandse paspoorten 2021"
[4]: https://www.icao.int/sites/default/files/publications/DocSeries/9303_p5_cons_en.pdf?utm_source=chatgpt.com "Doc 9303 Machine Readable Travel Documents"
