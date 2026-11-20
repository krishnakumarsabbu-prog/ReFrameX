      * Sample copybook for ground truth testing.
       01  POLICY-RECORD.
           05  POL-NUMBER       PIC 9(10).
           05  POL-TYPE         PIC X(3).
           05  POL-HOLDER-NAME  PIC X(30).
           05  POL-EFF-DATE     PIC 9(8).
           05  POL-EXP-DATE     PIC 9(8).
           05  POL-PREMIUM      PIC 9(7)V99.
           05  POL-STATUS       PIC X(1).
               88  POL-ACTIVE   VALUE 'A'.
               88  POL-LAPSED   VALUE 'L'.
               88  POL-CANCEL   VALUE 'C'.
