       01  TRANS-RECORD.
           05  TRN-ID          PIC 9(10).
           05  TRN-TYPE        PIC X(2).
           05  TRN-AMOUNT      PIC 9(10)V99.
           05  TRN-DATE        PIC 9(8).
           05  TRN-CURRENCY    PIC X(3).
           05  TRN-LINE-ITEM   OCCURS 20
                              DEPENDING ON TRN-COUNT.
               10  LI-DESC    PIC X(30).
               10  LI-AMT     PIC 9(7)V99.
               10  LI-CODE    PIC X(5).
           05  TRN-COUNT       PIC 9(2).
           05  TRN-BUFFER      PIC X(50).
           05  TRN-BUFFER-NUM  REDEFINES TRN-BUFFER
                              PIC 9(50).
