      * SYNTHETIC fixture copybook — transaction record layout.
      * This copybook is intentionally omitted from the initial
      * synthetic_complex fixture to demonstrate the evidence-improvement
      * workflow. Add it after the first assessment to show before/after.
       01  TRANSACTION-RECORD.
           05  TRANS-ID          PIC X(15).
           05  TRANS-ACCT-NUM    PIC 9(10).
           05  TRANS-DATE        PIC 9(8).
           05  TRANS-TIME        PIC 9(6).
           05  TRANS-AMOUNT      PIC 9(9)V99.
           05  TRANS-TYPE        PIC X(3).
           05  TRANS-STATUS      PIC X(2).
               88  TRANS-PENDING  VALUE 'PE'.
               88  TRANS-POSTED   VALUE 'PO'.
               88  TRANS-REVERSED VALUE 'RV'.
           05  TRANS-CURRENCY    PIC X(3).
           05  TRANS-REF         PIC X(20).
