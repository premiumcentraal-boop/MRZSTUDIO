You are auditing an MRZ validation system. Your task is to compare the system’s current MRZ check-digit equation against the correct ICAO Doc 9303 TD1 equation and correct any implementation mistakes.

Reference MRZ sample to verify:

I<NLDIM8H949900140288351<<<<<2
8401212F2901145NLD<<<<<<<<<<<8
VELTMAN<<CARLIJN<<<<<<<<<<<<<<

Document metadata:
- Issuing country: NLD
- Nationality: NLD
- Document number: IM8H94990
- Date of birth: 1984-01-21
- Sex: F
- Date of expiry: 2029-01-14
- BSN / optional data: 140288351
- Name: surname VELTMAN, given name CARLIJN

Correct MRZ check digit equation:

For any checked MRZ field S:

check_digit(S) = (
  Σ value(S[i]) × weight[i mod 3]
) mod 10

Where the repeating weights are:

[7, 3, 1, 7, 3, 1, ...]

Character values:
- "0" to "9" = 0 to 9
- "A" to "Z" = 10 to 35
- "<" = 0

The output check digit must always be a numeric character from "0" to "9".
A calculated result of 0 must stay "0".
Never replace a calculated check digit of 0 with "<".

TD1 position rules for this Dutch ID-card style:

Line 1, 30 characters:
- positions 1-2: document code
- positions 3-5: issuing state
- positions 6-14: document number
- position 15: document-number check digit
- positions 16-30: optional data

Line 2, 30 characters:
- positions 1-6: date of birth, YYMMDD
- position 7: date-of-birth check digit
- position 8: sex
- positions 9-14: date of expiry, YYMMDD
- position 15: expiry-date check digit
- positions 16-18: nationality
- positions 19-29: optional data
- position 30: composite check digit

Line 3, 30 characters:
- name field
- format: SURNAME<<GIVEN<NAMES
- no check digit is calculated over the name line

For the supplied Dutch 2014/pre-2021 style sample:

1. Document number check:
Input field:
IM8H94990

Expected calculation:
I=18, M=22, 8=8, H=17, 9=9, 4=4, 9=9, 9=9, 0=0

Weighted sum:
18×7 + 22×3 + 8×1 + 17×7 + 9×3 + 4×1 + 9×7 + 9×3 + 0×1 = 440

440 mod 10 = 0

Expected check digit:
0

Therefore line 1 position 15 must be "0", not "<".

2. Date of birth check:
Input field:
840121

Weighted sum:
82

82 mod 10 = 2

Expected check digit:
2

Therefore line 2 position 7 must be "2".

3. Expiry date check:
Input field:
290114

Weighted sum:
55

55 mod 10 = 5

Expected check digit:
5

Therefore line 2 position 15 must be "5".

4. Dutch optional-data / BSN check:
Input field:
140288351

Weighted sum:
102

102 mod 10 = 2

Expected check digit:
2

In this sample, line 1 positions 16-24 contain:
140288351

Line 1 positions 25-29 are filler:
<<<<<

Line 1 position 30 contains the optional-data check digit:
2

So line 1 optional data is:
140288351<<<<<2

Important:
The BSN may also have its own Dutch elfproef validation, but the MRZ check digit is not the elfproef. The MRZ check digit uses the ICAO 7,3,1 modulus 10 equation.

5. Composite check digit:
For TD1, calculate the composite check digit over this concatenated data:

line 1 positions 6-30
+ line 2 positions 1-7
+ line 2 positions 9-15
+ line 2 positions 19-29

For this sample, that means:

IM8H949900140288351<<<<<2
+ 8401212
+ 2901145
+ <<<<<<<<<<<

Combined string:
IM8H949900140288351<<<<<284012122901145<<<<<<<<<<<

Weighted sum:
688

688 mod 10 = 8

Expected composite check digit:
8

Therefore line 2 position 30 must be "8".

Required audit tasks:

1. Inspect the current system’s MRZ check-digit implementation.
2. Verify that it uses:
   - weights 7, 3, 1 repeating
   - A=10 through Z=35
   - digits as their numeric values
   - filler "<" as 0
   - final result modulo 10
3. Check whether the system incorrectly converts calculated "0" into "<".
   - If yes, fix it.
   - A calculated check digit of 0 must always output "0".
4. Check whether the system incorrectly treats "<" as a zero replacement.
   - If yes, fix it.
   - "<" is a filler character, not a check-digit substitute.
5. Verify TD1 field positions exactly.
6. Verify that the composite check digit includes the correct TD1 fields:
   - line 1 positions 6-30
   - line 2 positions 1-7
   - line 2 positions 9-15
   - line 2 positions 19-29
7. Verify that the name line is checked only for format and length, not by check digit.
8. Verify that Dutch 2014/pre-2021 ID-card style can contain BSN in line 1 optional data.
9. Verify that Dutch 2021+ ID-card style should not encode BSN in the MRZ.
10. Add model/layout detection warnings:
   - If BSN appears in the MRZ, classify as older Dutch ID-card layout, not 2021+.
   - If the system claims “2014 removed BSN from MRZ,” flag this as likely wrong.
   - BSN removal belongs to the newer 2021+ Dutch ID-card design.

Expected validation result for the supplied sample:

- MRZ length: valid, 3 lines × 30 characters
- Document number check digit: valid, expected 0
- Date of birth check digit: valid, expected 2
- Expiry date check digit: valid, expected 5
- Optional-data / BSN check digit: valid, expected 2
- Composite check digit: valid, expected 8
- Name-line format: valid for surname VELTMAN and given name CARLIJN
- Layout classification: Dutch TD1 ID-card MRZ using ICAO 9303 check digits, consistent with older/pre-2021 Dutch ID-card optional-data behavior where BSN appears in the MRZ

Do not return a newly generated MRZ. Return only:
- the corrected equation
- the corrected field mapping
- the detected bugs in the current implementation
- the expected check results above
- implementation guidance for validation-only behavior