      *----------------------------------------------------------------*
      * POLICY.cpy - POLICY RECORD LAYOUT WITH COMP-3 AND REDEFINES    *
      *----------------------------------------------------------------*
       01  POLICY-RECORD.
           05  POL-NUMBER          PIC X(12).
           05  POL-HOLDER-NAME     PIC X(35).
           05  POL-TYPE            PIC X(4).
           05  POL-LIMIT           PIC S9(9)V99 COMP-3.
           05  POL-DEDUCTIBLE      PIC S9(5)V99 COMP-3.
           05  POL-DETAILS         PIC X(50).
           05  AUTO-DETAILS REDEFINES POL-DETAILS.
               10  AUTO-VIN        PIC X(17).
               10  AUTO-MAKE       PIC X(15).
               10  AUTO-YEAR       PIC 9(4).
               10  FILLER          PIC X(14).
